#!/usr/bin/env node
/**
 * Builds the bundled match fixture from the local GRID event files.
 *
 * The app's database is gone, so every page reads `lib/data/fixtures/matches.json` instead. This
 * script streams the chosen series' event logs (hundreds of MB each, never loaded whole), rebuilds
 * the tables the app used to query (tournaments, teams, players, series, games, rounds,
 * player_round_stats, kill_events, spike_events) and writes them column-packed.
 *
 * Usage:
 *   node scripts/fixtures/build-fixtures.mjs --series=2843060,2843061 --out=lib/data/fixtures/matches.json
 *   node scripts/fixtures/build-fixtures.mjs --tournaments=826992,800680 --out=...
 *
 * The raw logs live in scripts/etl/data/events (27 GB, gitignored). Only the output is committed.
 *
 * Differences from the old ETL (scripts/etl/event-processor.ts), each a bug in that code:
 * - alive counts: GRID's round-end state has no `alive` flag, so the old code always stored 5 v 5.
 *   Here they come from replaying the kills (and revives) of the round.
 * - loadouts: the old code read them at round end (after deaths and pickups). Here they are read
 *   when the buy phase ends (`round-ended-freezetime`), which is what was actually bought.
 * - round phase: the old code compared a per-player average to team-sized thresholds, so almost
 *   every round was "eco". Here the team loadout uses the same bands as the economy report.
 * - kill times: events carry no `gameTime`, so every kill was at 0 ms. Here the time is measured
 *   from the end of the buy phase using the message timestamps.
 * - trades: the old `is_trade` checked whether the killer had died earlier (impossible). A kill is
 *   a trade when its victim killed one of the killer's teammates in the previous 5 seconds.
 * - clutches: judged at the moment a player becomes the last one alive, not at round end.
 * - restarted games: GRID logs replays of a game that was restarted; only games with a winner are kept.
 */

import { createReadStream, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const EVENTS_DIR = path.join(ROOT, "scripts/etl/data/events");

/** Seconds after a death in which a revenge kill counts as a trade (the usual analyst window). */
const TRADE_WINDOW_MS = 5000;

/** GRID ability ids that are ultimates. Anything not listed is a basic ability. */
const ULTIMATES = new Set([
  "astral-form", "cosmic-divide", "rolling-thunder", "orbital-strike", "tour-de-force",
  "not-dead-yet", "neural-theft", "annihilation", "nightfall", "thrash", "reckoning",
  "kill-contract", "blade-storm", "null-cmd", "lockdown", "overdrive", "from-the-shadows",
  "run-it-back", "showstopper", "empress", "resurrection", "seekers", "hunter's-fury",
  "armageddon", "viper's-pit", "steel-garden", "convergent-paths", "dimensional-drift",
]);

const WIN_TYPES = {
  opponentEliminated: "elimination",
  bombDefused: "spike_defuse",
  bombExploded: "spike_explode",
  timeExpired: "time",
  roundTimeExpired: "time",
};

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** Team loadout bands shared with the economy report: under 10k eco, under 20k force, else full. */
export function roundPhase(roundNumber, teamALoadout, teamBLoadout) {
  if (roundNumber === 1 || roundNumber === 13) return "pistol";
  const avg = (teamALoadout + teamBLoadout) / 2;
  if (avg < 10000) return "eco";
  if (avg < 20000) return "force";
  return "full";
}

function newRound(number) {
  return {
    number,
    startMs: null,
    endMs: null,
    sides: {},
    teamLoadout: {},
    playerLoadout: {},
    ultReady: {},
    kills: [],
    spike: [],
    ultUsed: new Set(),
    winner: null,
    winType: null,
  };
}

async function processSeries(file) {
  const series = { id: null, tournament: null, format: null, startedAt: null, teams: [], winner: null };
  const players = new Map();
  const games = new Map();
  let game = null;
  let round = null;
  const unknownWinTypes = new Set();

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(msg.occurredAt);
    for (const e of msg.events ?? []) {
      const ss = e.seriesState;
      switch (e.type) {
        case "tournament-started-series": {
          const t = e.target.state;
          series.id = t.id;
          series.tournament = { id: e.actor.id, name: e.actor.state?.name ?? e.actor.id };
          series.format = t.format ?? null;
          series.startedAt = t.startedAt ?? msg.occurredAt;
          series.teams = (t.teams ?? []).map((tm) => ({ id: tm.id, name: tm.name }));
          for (const tm of t.teams ?? []) {
            for (const p of tm.players ?? []) players.set(p.id, { id: p.id, name: p.name ?? p.id, teamId: tm.id });
          }
          break;
        }
        case "series-started-game": {
          const id = e.actor.stateDelta?.games?.slice(-1)[0]?.id;
          const gs = ss?.games?.find((g) => g.id === id);
          if (!id) break;
          game = {
            id,
            seq: gs?.sequenceNumber ?? games.size + 1,
            map: gs?.map?.name ?? "unknown",
            rounds: new Map(),
            winner: null,
            startMs: at,
            endMs: null,
            agents: {},
          };
          games.set(id, game);
          round = null;
          break;
        }
        case "game-started-round": {
          if (!game || e.actor.id !== game.id) break;
          const num = e.actor.stateDelta?.segments?.slice(-1)[0]?.sequenceNumber;
          if (!num) break;
          round = newRound(num);
          game.rounds.set(num, round);
          break;
        }
        case "round-ended-freezetime": {
          if (!game || !round) break;
          round.startMs = at;
          const gs = ss?.games?.find((g) => g.id === game.id);
          for (const tm of gs?.teams ?? []) {
            if (tm.side === "attacker" || tm.side === "defender") round.sides[tm.id] = tm.side;
            round.teamLoadout[tm.id] = tm.loadoutValue ?? 0;
            for (const p of tm.players ?? []) {
              round.playerLoadout[p.id] = { team: tm.id, value: p.loadoutValue ?? 0, armor: p.currentArmor ?? 0 };
              if (p.character?.name) game.agents[p.id] = p.character.name;
              const ult = (p.abilities ?? []).find((a) => ULTIMATES.has(a.id));
              round.ultReady[p.id] = ult ? ult.ready === true : false;
              if (!players.has(p.id)) players.set(p.id, { id: p.id, name: p.name ?? p.id, teamId: tm.id });
            }
          }
          break;
        }
        case "player-killed-player":
        case "player-teamkilled-player":
        case "player-selfkilled-player": {
          if (!round) break;
          const self = e.type === "player-selfkilled-player";
          const actor = e.actor;
          const target = self ? e.actor : e.target;
          const d = actor.stateDelta?.round ?? {};
          const weapon = self ? "self" : Object.keys(d.weaponKills ?? d.weaponTeamkills ?? {})[0] ?? "unknown";
          const assisters = (d.killAssistsReceivedFromPlayer ?? []).map((a) => a.playerId).filter(Boolean);
          round.kills.push({
            t: round.startMs ? Math.max(0, at - round.startMs) : 0,
            killer: self ? null : actor.id,
            killerTeam: self ? null : actor.state?.teamId ?? null,
            victim: target.id,
            victimTeam: target.state?.teamId ?? null,
            weapon,
            teamkill: e.type === "player-teamkilled-player",
            self,
            kx: self ? null : actor.state?.game?.position?.x ?? null,
            ky: self ? null : actor.state?.game?.position?.y ?? null,
            vx: target.state?.game?.position?.x ?? null,
            vy: target.state?.game?.position?.y ?? null,
            assisters,
            revive: false,
          });
          break;
        }
        case "player-revived-player":
        case "player-selfrevived-player": {
          if (!round) break;
          const id = e.type === "player-selfrevived-player" ? e.actor.id : e.target?.id;
          if (id) round.kills.push({ revive: true, victim: id, t: round.startMs ? at - round.startMs : 0 });
          break;
        }
        case "player-completed-plantBomb":
          if (!round) break;
          round.spike.push({
            type: "plant_complete",
            t: round.startMs ? at - round.startMs : 0,
            player: e.actor.id,
            x: e.actor.state?.game?.position?.x ?? null,
            y: e.actor.state?.game?.position?.y ?? null,
          });
          break;
        case "player-completed-defuseBomb":
          if (!round) break;
          round.spike.push({ type: "defuse_complete", t: round.startMs ? at - round.startMs : 0, player: e.actor.id });
          break;
        case "team-completed-explodeBomb":
        case "player-completed-explodeBomb":
          if (!round || round.spike.some((s) => s.type === "explode")) break;
          round.spike.push({ type: "explode", t: round.startMs ? at - round.startMs : 0, player: null });
          break;
        case "player-used-ability":
          if (round && ULTIMATES.has(e.target?.id)) round.ultUsed.add(e.actor.id);
          break;
        case "team-won-round": {
          if (!game) break;
          const num = e.target?.state?.sequenceNumber;
          const r = game.rounds.get(num);
          if (!r) break;
          r.winner = e.actor.id;
          const wt = e.actor.stateDelta?.round?.winType;
          r.winType = WIN_TYPES[wt] ?? "time";
          if (wt && !WIN_TYPES[wt]) unknownWinTypes.add(wt);
          r.endMs = at;
          break;
        }
        case "team-won-game": {
          const g = games.get(e.target?.id);
          if (g) {
            g.winner = e.actor.id;
            g.endMs = at;
          }
          break;
        }
        case "team-won-series":
          series.winner = e.actor.id;
          break;
      }
    }
  }
  return { series, players, games, unknownWinTypes };
}

function buildTables(parsed) {
  const out = {
    tournaments: new Map(),
    teams: new Map(),
    players: new Map(),
    series: [],
    games: [],
    rounds: [],
    player_round_stats: [],
    kill_events: [],
    spike_events: [],
  };
  const notes = [];

  for (const { series, players, games, unknownWinTypes } of parsed) {
    if (!series.id || series.teams.length !== 2) {
      notes.push(`skipped a file with no series header`);
      continue;
    }
    for (const w of unknownWinTypes) notes.push(`series ${series.id}: unknown win type ${w} stored as "time"`);
    out.tournaments.set(series.tournament.id, { id: series.tournament.id, name: series.tournament.name });
    for (const t of series.teams) out.teams.set(t.id, { id: t.id, name: t.name });
    const [teamA, teamB] = series.teams.map((t) => t.id);

    const kept = [...games.values()]
      .filter((g) => g.winner && [...g.rounds.values()].filter((r) => r.winner).length >= 13)
      .sort((a, b) => a.startMs - b.startMs);

    kept.forEach((g, i) => {
      const gameRounds = [...g.rounds.values()].filter((r) => r.winner).sort((a, b) => a.number - b.number);
      const score = { [teamA]: 0, [teamB]: 0 };
      for (const r of gameRounds) score[r.winner] = (score[r.winner] ?? 0) + 1;
      out.games.push({
        id: g.id,
        series_id: series.id,
        sequence_number: i + 1,
        map_name: g.map,
        team_a_score: score[teamA],
        team_b_score: score[teamB],
        winner_id: g.winner,
        duration_ms: g.endMs ? g.endMs - g.startMs : null,
      });

      for (const r of gameRounds) {
        const roundId = `${g.id}_${r.number}`;
        const roster = Object.entries(r.playerLoadout).map(([pid, v]) => ({ pid, team: v.team }));
        const alive = new Map(roster.map((p) => [p.pid, p.team]));
        const aliveCount = (team) => [...alive.values()].filter((t) => t === team).length;
        const stat = new Map(
          roster.map(({ pid, team }) => [
            pid,
            {
              kills: 0, deaths: 0, assists: 0, first_kill: false, first_death: false, traded: false,
              got_trade: false, clutch_situation: false, clutch_won: false, team,
            },
          ]),
        );
        const clutchTaken = new Set();
        const kills = r.kills.filter((k) => !k.revive);
        let firstDone = false;

        r.kills.forEach((k) => {
          if (k.revive) {
            const team = r.playerLoadout[k.victim]?.team;
            if (team) alive.set(k.victim, team);
            return;
          }
          const idx = kills.indexOf(k);
          const isFirst = !firstDone;
          firstDone = true;
          // A trade: this kill's victim killed one of the killer's teammates in the last 5 s.
          const isTrade =
            !!k.killer &&
            kills.slice(0, idx).some(
              (p) => k.t - p.t <= TRADE_WINDOW_MS && p.killer === k.victim && p.victimTeam === k.killerTeam && !p.teamkill,
            );
          const vs = stat.get(k.victim);
          if (vs) {
            vs.deaths++;
            if (isFirst) vs.first_death = true;
            // Traded: someone killed this player's killer within 5 s.
            if (k.killer && kills.slice(idx + 1).some((n) => n.t - k.t <= TRADE_WINDOW_MS && n.victim === k.killer)) {
              vs.traded = true;
            }
          }
          const ks = k.killer ? stat.get(k.killer) : undefined;
          if (ks && !k.teamkill) {
            ks.kills++;
            if (isFirst) ks.first_kill = true;
            if (isTrade) ks.got_trade = true;
          }
          for (const a of k.assisters) {
            const as = stat.get(a);
            if (as) as.assists++;
          }
          out.kill_events.push({
            round_id: roundId,
            game_time_ms: k.t,
            killer_id: k.killer,
            victim_id: k.victim,
            weapon: k.weapon,
            is_first_kill: isFirst,
            is_trade: isTrade,
            is_self_kill: k.self,
            killer_pos_x: k.kx == null ? null : Math.round(k.kx),
            killer_pos_y: k.ky == null ? null : Math.round(k.ky),
            victim_pos_x: k.vx == null ? null : Math.round(k.vx),
            victim_pos_y: k.vy == null ? null : Math.round(k.vy),
            assist_count: k.assisters.length,
          });

          alive.delete(k.victim);
          // Clutch: the moment a team is down to one player while the other side still has someone.
          for (const team of [teamA, teamB]) {
            if (clutchTaken.has(team)) continue;
            const other = team === teamA ? teamB : teamA;
            if (aliveCount(team) === 1 && aliveCount(other) > 0) {
              const last = [...alive.entries()].find(([, t]) => t === team)?.[0];
              const ls = last ? stat.get(last) : undefined;
              if (ls) {
                ls.clutch_situation = true;
                ls.clutch_won = r.winner === team;
                clutchTaken.add(team);
              }
            }
          }
        });

        const aLoad = r.teamLoadout[teamA] ?? 0;
        const bLoad = r.teamLoadout[teamB] ?? 0;
        const side = r.sides[teamA] === "attacker" ? "attack" : r.sides[teamA] === "defender" ? "defense" : null;
        out.rounds.push({
          id: roundId,
          game_id: g.id,
          round_number: r.number,
          phase: roundPhase(r.number, aLoad, bLoad),
          winning_team_id: r.winner,
          winning_condition: r.winType,
          spike_planted: r.spike.some((s) => s.type === "plant_complete"),
          spike_defused: r.spike.some((s) => s.type === "defuse_complete"),
          team_a_alive: aliveCount(teamA),
          team_b_alive: aliveCount(teamB),
          team_a_loadout_value: aLoad,
          team_b_loadout_value: bLoad,
          duration_ms: r.startMs && r.endMs ? r.endMs - r.startMs : null,
          team_a_side: side,
        });

        for (const [pid, s] of stat) {
          out.player_round_stats.push({
            round_id: roundId,
            player_id: pid,
            team_id: s.team,
            agent: g.agents[pid] ?? "unknown",
            kills: s.kills,
            deaths: s.deaths,
            assists: s.assists,
            first_kill: s.first_kill,
            first_death: s.first_death,
            traded: s.traded,
            got_trade: s.got_trade,
            clutch_situation: s.clutch_situation,
            clutch_won: s.clutch_won,
            loadout_value: r.playerLoadout[pid]?.value ?? 0,
            armor: r.playerLoadout[pid]?.armor ?? 0,
            ult_ready: r.ultReady[pid] ?? false,
            ultimate_used: r.ultUsed.has(pid),
          });
          const p = players.get(pid);
          if (p) out.players.set(pid, { id: pid, name: p.name, team_id: s.team });
        }
        for (const s of r.spike) {
          out.spike_events.push({
            round_id: roundId,
            game_time_ms: s.t,
            event_type: s.type,
            player_id: s.player,
            pos_x: s.x == null ? null : Math.round(s.x),
            pos_y: s.y == null ? null : Math.round(s.y),
          });
        }
      }
    });

    const gameWins = { [teamA]: 0, [teamB]: 0 };
    for (const g of out.games.filter((x) => x.series_id === series.id)) gameWins[g.winner_id]++;
    const winner = series.winner ?? (gameWins[teamA] > gameWins[teamB] ? teamA : gameWins[teamB] > gameWins[teamA] ? teamB : null);
    out.series.push({
      id: series.id,
      tournament_id: series.tournament.id,
      start_time: series.startedAt,
      format: series.format,
      team_a_id: teamA,
      team_b_id: teamB,
      winner_id: winner,
    });
  }

  // Tournament date ranges come from their series.
  for (const t of out.tournaments.values()) {
    const starts = out.series.filter((s) => s.tournament_id === t.id).map((s) => s.start_time).sort();
    t.start_date = starts[0]?.slice(0, 10) ?? null;
    t.end_date = starts.at(-1)?.slice(0, 10) ?? null;
  }
  return { out, notes };
}

/**
 * Column-packed table: one header row, then value arrays, booleans as 1/0. `round_id` is stored as
 * the index of the round in the rounds table (`refs`), because the long game-UUID round ids were a
 * third of the file. lib/data/fixture.ts unpacks both.
 */
function pack(rows, roundIndex) {
  const cols = Object.keys(rows[0] ?? {});
  const enc = (c, v) => {
    if (v === true) return 1;
    if (v === false) return 0;
    if (c === "round_id" && roundIndex) return roundIndex.get(v);
    return v ?? null;
  };
  return {
    cols,
    ...(roundIndex && cols.includes("round_id") ? { refs: { round_id: "rounds" } } : {}),
    bools: cols.filter((c) => typeof rows[0]?.[c] === "boolean"),
    rows: rows.map((r) => cols.map((c) => enc(c, r[c]))),
  };
}

async function main() {
  const outPath = path.resolve(ROOT, arg("out") ?? "lib/data/fixtures/matches.json");
  let ids = (arg("series") ?? "").split(",").filter(Boolean);
  const tournaments = (arg("tournaments") ?? "").split(",").filter(Boolean);
  if (tournaments.length) {
    const catalog = JSON.parse(readFileSync(arg("catalog"), "utf8"));
    ids.push(...catalog.filter((c) => tournaments.includes(c.tid)).map((c) => c.sid));
  }
  ids = [...new Set(ids)];
  if (!ids.length) throw new Error("Pass --series=<ids> or --tournaments=<ids> --catalog=<file>");
  const files = readdirSync(EVENTS_DIR);
  const parsed = [];
  for (const id of ids) {
    const file = files.find((f) => f === `${id}_events.jsonl`);
    if (!file) throw new Error(`No event file for series ${id}`);
    const t0 = Date.now();
    parsed.push(await processSeries(path.join(EVENTS_DIR, file)));
    console.log(`series ${id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const { out, notes } = buildTables(parsed);
  const roundIndex = new Map(out.rounds.map((r, i) => [r.id, i]));
  const fixture = {
    source: "GRID esports event logs (VCT Americas), processed by scripts/fixtures/build-fixtures.mjs",
    builtFrom: ids,
    tournaments: pack([...out.tournaments.values()]),
    teams: pack([...out.teams.values()]),
    players: pack([...out.players.values()].sort((a, b) => a.name.localeCompare(b.name))),
    series: pack(out.series.sort((a, b) => a.start_time.localeCompare(b.start_time))),
    games: pack(out.games),
    rounds: pack(out.rounds),
    player_round_stats: pack(out.player_round_stats, roundIndex),
    kill_events: pack(out.kill_events, roundIndex),
    spike_events: pack(out.spike_events, roundIndex),
  };
  mkdirSync(path.dirname(outPath), { recursive: true });
  const json = JSON.stringify(fixture);
  writeFileSync(outPath, json);
  for (const n of notes) console.log(`note: ${n}`);
  console.log(
    `wrote ${path.relative(ROOT, outPath)}: ${(json.length / 1e6).toFixed(2)} MB, ` +
      Object.entries(out)
        .map(([k, v]) => `${k} ${v.size ?? v.length}`)
        .join(", "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
