import type { Metadata } from "next"
import Link from "next/link"
import { Crosshair, Flame, HeartCrack, Repeat, Shield, Zap } from "lucide-react"
import { Card, Chip, EmptyState, SectionHeader, StatTile } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { InsightCard } from "@/components/lumina/insight-card"
import { TeamBadge } from "@/components/lumina/team-badge"
import { UrlPicker } from "@/components/lumina/url-picker"
import { pct } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listPlayers } from "@/lib/data/queries"
import { recentSeriesForPlayer } from "@/lib/llm/entity-resolver"
import { agentLabel, PHASE_LABELS, tournamentLabel } from "@/lib/data/names"
import {
  agentPerformanceInsight,
  clutchInsight,
  ecoRoundInsight,
  firstDeathInsight,
  multiKillInsight,
  openingDuelsInsight,
  tradingInsight,
} from "@/lib/analytics/player-insights"

export const metadata: Metadata = {
  title: "Player insights",
  description: "One player's opening duels, trades, clutches, agents and results on each buy.",
}

type Props = { searchParams: Promise<{ player?: string; t?: string }> }

export default async function PlayerAnalyticsPage({ searchParams }: Props) {
  const { player: playerId, t: tournamentId } = await searchParams
  const db = getDb()
  const players = listPlayers(db)
  const player = playerId ? players.find((p) => p.id === playerId) : undefined
  const picks = [...players].sort((a, b) => b.rounds - a.rounds).slice(0, 8)

  const pickers = (
    <>
      <UrlPicker
        label="Player"
        param="player"
        value={player?.id}
        basePath="/player-analytics"
        keep={{ t: tournamentId }}
        placeholder="Choose a player"
        options={players.map((p) => ({ value: p.id, label: p.team_name ? `${p.name} (${p.team_name})` : p.name }))}
      />
      {player && (
        <UrlPicker
          label="Tournament"
          param="t"
          value={tournamentId}
          basePath="/player-analytics"
          keep={{ player: player.id }}
          placeholder="All tournaments"
          options={db.tournaments.map((t) => ({ value: t.id, label: tournamentLabel(t.name) }))}
        />
      )}
    </>
  )

  if (!player) {
    return (
      <div className="space-y-8">
        <PageHeader title="Player insights" description="How a player wins and loses rounds: opening duels, trades, clutches and buys." />
        <div className="flex flex-col gap-3 sm:flex-row">{pickers}</div>
        <Card>
          <EmptyState
            icon={Crosshair}
            title={playerId ? "We couldn't find that player" : "Pick a player"}
            message="Choose anyone from the list, or start with one of the most-played:"
            action={
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {picks.map((p) => (
                  <Link key={p.id} href={`/player-analytics?player=${p.id}`} className="inline-flex min-h-11 items-center">
                    <Chip>{p.name}</Chip>
                  </Link>
                ))}
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  const t = tournamentId ?? null
  const [firstDeath, trading, opening, clutch, multi, eco, agents] = await Promise.all([
    firstDeathInsight(player.id, t),
    tradingInsight(player.id, t),
    openingDuelsInsight(player.id, t),
    clutchInsight(player.id, t),
    multiKillInsight(player.id, t),
    ecoRoundInsight(player.id, t),
    agentPerformanceInsight(player.id, t),
  ])
  const recent = recentSeriesForPlayer(db, player.id, 4)
  const noData = !opening

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={player.team_name ?? "No team"}
        title={
          <span className="flex items-center gap-3">
            {player.team_name && <TeamBadge name={player.team_name} size="lg" />}
            {player.name}
          </span>
        }
        description={`Main agents: ${player.top_agents.map(agentLabel).join(", ")}.`}
      />
      <div className="flex flex-col gap-3 sm:flex-row">{pickers}</div>

      {noData ? (
        <Card>
          <EmptyState icon={Crosshair} title="No rounds in this tournament" message={`${player.name} didn't play in the tournament you picked. Choose All tournaments to see everything.`} tone="neutral" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={Crosshair} value={player.kd.toFixed(2)} label="K/D" detail={`${player.kills} kills, ${player.deaths} deaths overall`} />
            <StatTile icon={Zap} value={multi ? multi.data.kills_per_round.toFixed(2) : "–"} label="Kills per round" detail={`${opening!.data.total_rounds} rounds`} />
            <StatTile icon={Flame} value={`${opening!.data.first_kills}–${opening!.data.first_deaths}`} label="Opening duels" detail={`Won ${pct(opening!.data.success_rate)}`} />
            <StatTile icon={Shield} value={clutch ? `${clutch.data.clutches_won}/${clutch.data.clutch_situations}` : "0"} label="Clutches won" detail="As the last one alive" />
          </div>

          <section aria-labelledby="insights" className="space-y-4">
            <SectionHeader id="insights" title="What the numbers say" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {opening && (
                <InsightCard icon={Flame} title="Opening duels" value={pct(opening.data.success_rate)} description={`Won ${opening.data.first_kills} of ${opening.data.first_kills + opening.data.first_deaths} first fights`} insight={opening.insight} recommendation={opening.recommendation} confidence={opening.confidence} />
              )}
              {trading && (
                <InsightCard icon={Repeat} title="Deaths traded" value={pct(trading.data.trade_rate)} description={`${trading.data.traded} of ${trading.data.total_deaths} deaths avenged within 5 seconds`} insight={trading.insight} recommendation={trading.recommendation} confidence={trading.confidence} />
              )}
              {firstDeath && (
                <InsightCard icon={HeartCrack} title="Dying first" value={pct(firstDeath.data.loss_rate)} description={`Rounds lost after dying first with no kill or assist (${firstDeath.data.losses} of ${firstDeath.data.total})`} insight={firstDeath.insight} recommendation={firstDeath.recommendation} confidence={firstDeath.confidence} />
              )}
              {clutch && (
                <InsightCard icon={Shield} title="Clutches" value={pct(clutch.data.clutch_rate)} description={`${clutch.data.clutches_won} of ${clutch.data.clutch_situations} won as the last player alive`} insight={clutch.insight} recommendation={clutch.recommendation} confidence={clutch.confidence} />
              )}
              {multi && (
                <InsightCard icon={Zap} title="Multi-kill rounds" value={multi.data.three_plus_kills} description={`Rounds with 3+ kills (${multi.data.two_plus_kills} with 2+, ${multi.data.aces} aces)`} insight={multi.insight} recommendation={multi.recommendation} confidence={multi.confidence} />
              )}
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            {agents && agents.data.agents.length > 0 && (
              <section aria-labelledby="agents" className="space-y-4">
                <SectionHeader id="agents" title="Agents" description={agents.insight} />
                <Card padding="none" className="overflow-hidden">
                  <table className="w-full text-left text-[15px]">
                    <thead>
                      <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                        <th scope="col" className="px-4 py-3 font-extrabold">Agent</th>
                        <th scope="col" className="px-2 py-3 text-right font-extrabold">Rounds</th>
                        <th scope="col" className="px-2 py-3 text-right font-extrabold">K/D</th>
                        <th scope="col" className="px-4 py-3 text-right font-extrabold">Rounds won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.data.agents.map((a) => (
                        <tr key={a.agent} className="border-t border-line">
                          <td className="px-4 py-2.5 font-bold text-ink">{agentLabel(a.agent)}</td>
                          <td className="tabular px-2 py-2.5 text-right text-ink">{a.rounds_played}</td>
                          <td className="tabular px-2 py-2.5 text-right text-ink">{a.kd_ratio.toFixed(2)}</td>
                          <td className="tabular px-4 py-2.5 text-right text-ink">{pct(a.win_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </section>
            )}

            {eco && (
              <section aria-labelledby="buys" className="space-y-4">
                <SectionHeader id="buys" title="By buy" description="How the team did, and this player's K/D, on each kind of round." />
                <Card padding="none" className="overflow-hidden">
                  <table className="w-full text-left text-[15px]">
                    <thead>
                      <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                        <th scope="col" className="px-4 py-3 font-extrabold">Round type</th>
                        <th scope="col" className="px-2 py-3 text-right font-extrabold">Rounds</th>
                        <th scope="col" className="px-2 py-3 text-right font-extrabold">K/D</th>
                        <th scope="col" className="px-4 py-3 text-right font-extrabold">Won</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["pistol", "eco", "force", "full"]
                        .filter((p) => eco.data.phases[p])
                        .map((p) => (
                          <tr key={p} className="border-t border-line">
                            <td className="px-4 py-2.5 font-bold text-ink">{PHASE_LABELS[p]}</td>
                            <td className="tabular px-2 py-2.5 text-right text-ink">{eco.data.phases[p].rounds}</td>
                            <td className="tabular px-2 py-2.5 text-right text-ink">{eco.data.phases[p].kd_ratio.toFixed(2)}</td>
                            <td className="tabular px-4 py-2.5 text-right text-ink">{pct(eco.data.phases[p].win_rate)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </Card>
                <p className="text-[13px] text-ink-2">Eco: team spent under 10k. Force buy: under 20k. Full buy: 20k or more. Pistol: rounds 1 and 13.</p>
              </section>
            )}
          </div>

          {recent.length > 0 && (
            <section aria-labelledby="recent" className="space-y-4">
              <SectionHeader id="recent" title="Recent series" />
              <div className="grid gap-3 sm:grid-cols-2">
                {recent.map((r) => (
                  <Link key={r.series_id} href={`/analytics?series=${r.series_id}&team=${r.team_id}`} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-card)] hover:bg-surface-2">
                    <TeamBadge name={r.team_name} size="sm" />
                    <span className="text-[15px] text-ink">
                      {r.team_name} vs <span className="font-bold">{r.opponent_name}</span>
                    </span>
                    <span className="ml-auto text-sm font-bold text-accent-text">Match report</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
