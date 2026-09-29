import type { Metadata } from "next"
import Link from "next/link"
import { Coins, Crosshair, Hourglass, Repeat, Sparkles, Swords, Target, Users } from "lucide-react"
import { Badge, Card, EmptyState, SectionHeader, StatTile } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { InsightCard } from "@/components/lumina/insight-card"
import { SeriesCard } from "@/components/lumina/series-card"
import { TeamBadge } from "@/components/lumina/team-badge"
import { UrlPicker } from "@/components/lumina/url-picker"
import { credits, pct, seconds } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listSeries, listTeams } from "@/lib/data/queries"
import { mapLabel, PHASE_LABELS, tournamentLabel } from "@/lib/data/names"
import {
  criticalMomentsInsight,
  economyInsight,
  firstBloodInsight,
  openingDuelsInsight,
  pistolInsight,
  timingInsight,
  tradingInsight,
  ultimatesInsight,
} from "@/lib/analytics/macro-insights"

export const metadata: Metadata = {
  title: "Team review",
  description: "A team's pistol rounds, economy, trading and the rounds that swung its games.",
}

type Props = { searchParams: Promise<{ team?: string; t?: string }> }

const PRIORITY = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" } as const

export default async function MacroReviewPage({ searchParams }: Props) {
  const { team: teamId, t: tournamentId } = await searchParams
  const db = getDb()
  const teams = listTeams(db)
  const team = teamId ? teams.find((x) => x.id === teamId) : undefined

  const pickers = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <UrlPicker
        label="Team"
        param="team"
        value={team?.id}
        basePath="/macro-review"
        keep={{ t: tournamentId }}
        placeholder="Choose a team"
        options={teams.map((x) => ({ value: x.id, label: x.name }))}
      />
      {team && (
        <UrlPicker
          label="Tournament"
          param="t"
          value={tournamentId}
          basePath="/macro-review"
          keep={{ team: team.id }}
          placeholder="All tournaments"
          options={db.tournaments.map((x) => ({ value: x.id, label: tournamentLabel(x.name) }))}
        />
      )}
    </div>
  )

  if (!team) {
    return (
      <div className="space-y-8">
        <PageHeader title="Team review" description="How a team plays its rounds: pistols, economy, trades and the moments that swung games." />
        {pickers}
        <Card>
          <EmptyState
            icon={Users}
            title={teamId ? "We couldn't find that team" : "Pick a team"}
            message="Choose one of the ten teams in the sample."
            action={
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {teams.map((x) => (
                  <Link key={x.id} href={`/macro-review?team=${x.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-[15px] font-bold text-ink">
                    {x.name}
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
  const [pistol, firstBlood, trading, opening, economy, timing, ults, moments] = await Promise.all([
    pistolInsight(team.id, t),
    firstBloodInsight(team.id, t),
    tradingInsight(team.id, t),
    openingDuelsInsight(team.id, t),
    economyInsight(team.id, t),
    timingInsight(team.id, t),
    ultimatesInsight(team.id, t),
    criticalMomentsInsight(team.id, t),
  ])
  const series = listSeries(db, { teamId: team.id, tournamentId: t })
  const top = moments.data.moments.filter((m) => m.priority !== "LOW").slice(0, 8)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Team review"
        title={
          <span className="flex items-center gap-3">
            <TeamBadge name={team.name} size="lg" />
            {team.name}
          </span>
        }
        description={`Latest roster: ${team.roster.join(", ")}.`}
      />
      {pickers}

      {series.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No matches in this tournament" message={`${team.name} didn't play in the tournament you picked.`} tone="neutral" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={Swords} value={`${series.filter((s) => s.winner_id === team.id).length}–${series.filter((s) => s.winner_id !== team.id).length}`} label="Series" />
            <StatTile icon={Target} value={`${pistol.data.pistol_wins}/${pistol.data.pistol_rounds}`} label="Pistols won" detail={`Then won ${pct(pistol.data.conversion_rate)} of the next rounds`} />
            <StatTile icon={Crosshair} value={pct(firstBlood.data.conversion_rate)} label="Won after first kill" detail={`${firstBlood.data.first_bloods} opening kills`} />
            <StatTile icon={Repeat} value={pct(trading.data.overall_trade_rate)} label="Deaths traded" detail={`${trading.data.traded_deaths} of ${trading.data.total_deaths}`} />
          </div>

          <section aria-labelledby="insights" className="space-y-4">
            <SectionHeader id="insights" title="What the numbers say" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InsightCard icon={Target} title="Pistol rounds" value={pct(pistol.data.pistol_win_rate)} description={`Won ${pistol.data.pistol_wins} of ${pistol.data.pistol_rounds} pistol rounds`} insight={pistol.insight} recommendation={pistol.recommendation} confidence={pistol.confidence} />
              <InsightCard icon={Crosshair} title="After the first kill" value={pct(firstBlood.data.conversion_rate)} description={`Rounds won after getting the opening kill (${firstBlood.data.first_blood_wins} of ${firstBlood.data.first_bloods})`} insight={firstBlood.insight} recommendation={firstBlood.recommendation} confidence={firstBlood.confidence} />
              <InsightCard icon={Repeat} title="Trading" value={pct(trading.data.overall_trade_rate)} description={`Deaths avenged within 5 seconds; first deaths: ${pct(trading.data.first_death_trade_rate)}`} insight={trading.insight} recommendation={trading.recommendation} confidence={trading.confidence} />
              {timing && (
                <InsightCard icon={Hourglass} title="Timing" value={seconds(timing.data.avg_first_kill_time_ms)} description={`Average time to the first kill; rounds last ${seconds(timing.data.avg_round_duration_ms)}`} insight={timing.insight} recommendation={timing.recommendation} confidence={timing.confidence} />
              )}
              {ults && (
                <InsightCard icon={Sparkles} title="Ultimates" value={pct(ults.data.usage_rate)} description={`Share of player-rounds with an ultimate used; won ${pct(ults.data.ult_availability_win_rate)} when one was charged`} insight={ults.insight} recommendation={ults.recommendation} confidence={ults.confidence} />
              )}
              <InsightCard
                icon={Coins}
                title="Economy"
                value={pct(economy.data.decisions.find((d) => d.economy_decision === "full_buy")?.win_rate ?? 0)}
                description="Rounds won on a full buy"
                insight={economy.insight}
                recommendation={economy.recommendation}
                confidence={economy.confidence}
              />
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="duels" className="space-y-4">
              <SectionHeader id="duels" title="Opening duels by player" description="First kills and first deaths, best first." />
              <Card padding="none" className="overflow-hidden">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                      <th scope="col" className="px-4 py-3 font-extrabold">Player</th>
                      <th scope="col" className="px-2 py-3 text-right font-extrabold">Won–lost</th>
                      <th scope="col" className="px-4 py-3 text-right font-extrabold">Win rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opening.data.players.map((p: { player_id: string; player_name: string; first_kills: number; first_deaths: number; success_rate: number }) => (
                      <tr key={p.player_id} className="border-t border-line">
                        <td className="px-4 py-2.5">
                          <Link href={`/player-analytics?player=${p.player_id}`} className="font-bold text-ink hover:text-accent-text">
                            {p.player_name}
                          </Link>
                        </td>
                        <td className="tabular px-2 py-2.5 text-right text-ink">
                          {p.first_kills}–{p.first_deaths}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right text-ink">{pct(p.success_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section aria-labelledby="economy" className="space-y-4">
              <SectionHeader id="economy" title="By buy" description="What the team spent and how those rounds went." />
              <Card padding="none" className="overflow-hidden">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                      <th scope="col" className="px-4 py-3 font-extrabold">Buy</th>
                      <th scope="col" className="px-2 py-3 text-right font-extrabold">Rounds</th>
                      <th scope="col" className="px-2 py-3 text-right font-extrabold">Avg. spend</th>
                      <th scope="col" className="px-4 py-3 text-right font-extrabold">Won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economy.data.decisions.map((d) => (
                      <tr key={d.economy_decision} className="border-t border-line">
                        <td className="px-4 py-2.5 font-bold text-ink">{PHASE_LABELS[d.economy_decision] ?? d.economy_decision}</td>
                        <td className="tabular px-2 py-2.5 text-right text-ink">{d.rounds}</td>
                        <td className="tabular px-2 py-2.5 text-right text-ink">{credits(d.avg_loadout_value)}</td>
                        <td className="tabular px-4 py-2.5 text-right text-ink">{pct(d.win_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="text-[13px] text-ink-2">Eco: under 10k team spend. Force buy: 10k to 20k. Full buy: 20k or more.</p>
            </section>
          </div>

          <section aria-labelledby="moments" className="space-y-4">
            <SectionHeader id="moments" title="Rounds to rewatch" description={moments.insight} />
            {top.length === 0 ? (
              <Card>
                <EmptyState icon={Target} title="Nothing urgent" message="No round scored high enough to flag." tone="neutral" />
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {top.map((m) => {
                  const game = db.game.get(m.game_id)
                  return (
                    <Link key={m.round_id} href={`/game/${m.game_id}`} className="flex items-start gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-card)] hover:bg-surface-2">
                      <Badge tone={PRIORITY[m.priority]} className="shrink-0 whitespace-nowrap">{m.priority === "HIGH" ? "Must watch" : "Worth a look"}</Badge>
                      <span className="min-w-0">
                        <span className="block font-bold text-ink">
                          {game ? mapLabel(game.map_name) : "Map"}, round {m.round_number}
                        </span>
                        <span className="block text-[15px] text-ink-2">{m.description}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="series" className="space-y-4">
            <SectionHeader id="series" title="Matches" />
            <div className="space-y-3">
              {series.map((s) => (
                <SeriesCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
