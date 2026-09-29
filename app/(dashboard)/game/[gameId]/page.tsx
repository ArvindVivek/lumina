import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Card, SectionHeader, StatTile } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { Scoreboard } from "@/components/lumina/scoreboard"
import { TeamBadge } from "@/components/lumina/team-badge"
import { RoundList, type RoundItem } from "@/components/game/round-list"
import { getDb } from "@/lib/data"
import { playerName } from "@/lib/data/db"
import { gameDetail, scoreboard } from "@/lib/data/queries"
import { mapLabel } from "@/lib/data/names"
import { cn } from "@/lib/kl/cn"

type Props = { params: Promise<{ gameId: string }> }

export function generateStaticParams() {
  return getDb().games.map((g) => ({ gameId: g.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = gameDetail(getDb(), (await params).gameId)
  if (!g) return { title: "Map not found" }
  return {
    title: `${mapLabel(g.map_name)}: ${g.team_a_name} vs ${g.team_b_name}`,
    description: `${g.team_a_name} ${g.team_a_score}-${g.team_b_score} ${g.team_b_name} on ${mapLabel(g.map_name)}, round by round.`,
  }
}

export default async function GamePage({ params }: Props) {
  const { gameId } = await params
  const db = getDb()
  const g = gameDetail(db, gameId)
  if (!g) notFound()
  const rounds = db.roundsByGame.get(gameId) ?? []
  const aWon = g.winner_id === g.team_a_id

  const items: RoundItem[] = rounds.map((r) => {
    const stats = db.prsByRound.get(r.id) ?? []
    const agent = (id: string | null) => stats.find((p) => p.player_id === id)?.agent ?? "unknown"
    return {
      id: r.id,
      number: r.round_number,
      winnerIsA: r.winning_team_id === g.team_a_id,
      condition: r.winning_condition,
      planted: r.spike_planted,
      defused: r.spike_defused,
      aLoadout: r.team_a_loadout_value,
      bLoadout: r.team_b_loadout_value,
      aSide: r.team_a_side,
      kills: (db.killsByRound.get(r.id) ?? []).map((k) => ({
        t: k.game_time_ms,
        killer: k.killer_id ? playerName(db, k.killer_id) : "Self",
        killerAgent: agent(k.killer_id),
        killerIsA: stats.find((p) => p.player_id === (k.killer_id ?? k.victim_id))?.team_id === g.team_a_id,
        victim: playerName(db, k.victim_id),
        victimAgent: agent(k.victim_id),
        trade: k.is_trade,
      })),
    }
  })

  const won = (from: number, to: number) => rounds.filter((r) => r.round_number >= from && r.round_number <= to && r.winning_team_id === g.team_a_id).length
  const played = (from: number, to: number) => rounds.filter((r) => r.round_number >= from && r.round_number <= to).length
  const pistols = rounds.filter((r) => r.round_number === 1 || r.round_number === 13)
  const planted = rounds.filter((r) => r.spike_planted)
  const firstSide = rounds[0]?.team_a_side

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/series/${g.series_id}`, label: `${g.team_a_name} vs ${g.team_b_name}` }}
        eyebrow={`Map ${g.sequence_number} of ${g.series_game_count}`}
        title={mapLabel(g.map_name)}
      />

      <Card padding="lg">
        <div className="flex items-center justify-center gap-4 sm:gap-10">
          {[
            { name: g.team_a_name, score: g.team_a_score, won: aWon },
            { name: g.team_b_name, score: g.team_b_score, won: !aWon },
          ].map((t, i) => (
            <div key={t.name} className={cn("flex min-w-0 flex-1 items-center gap-3 sm:gap-4", i === 0 ? "justify-end" : "flex-row-reverse justify-end")}>
              <p className={cn("min-w-0 truncate font-bold text-ink max-sm:sr-only", i === 0 ? "text-right" : "text-left")}>{t.name}</p>
              <TeamBadge name={t.name} size="lg" tone={t.won ? "win" : "neutral"} />
              <span className={cn("tabular font-display text-hero", t.won ? "text-success-text" : "text-ink-2")}>{t.score}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={`${won(1, 12)}–${played(1, 12) - won(1, 12)}`}
          label="First half"
          detail={`${g.team_a_name} on ${firstSide === "attack" ? "attack" : firstSide === "defense" ? "defense" : "one side"}`}
        />
        <StatTile value={`${won(13, 24)}–${played(13, 24) - won(13, 24)}`} label="Second half" detail={`For ${g.team_a_name}`} />
        <StatTile
          value={`${pistols.filter((r) => r.winning_team_id === g.team_a_id).length}–${pistols.filter((r) => r.winning_team_id !== g.team_a_id).length}`}
          label="Pistol rounds"
          detail={`For ${g.team_a_name}`}
        />
        <StatTile value={planted.length} label="Spike plants" detail={`${planted.filter((r) => r.spike_defused).length} defused`} />
      </div>

      <section aria-labelledby="rounds" className="space-y-4">
        <SectionHeader id="rounds" title="Rounds" description="Every round in order: who won it, how, and what each team spent." />
        <RoundList rounds={items} teamA={g.team_a_name} teamB={g.team_b_name} />
      </section>

      <section aria-labelledby="board" className="space-y-4">
        <SectionHeader id="board" title="Scoreboard" />
        <Scoreboard
          lines={scoreboard(db, [db.game.get(gameId)!])}
          teams={[
            { id: g.team_a_id, name: g.team_a_name, won: aWon },
            { id: g.team_b_id, name: g.team_b_name, won: !aWon },
          ]}
        />
      </section>
    </div>
  )
}
