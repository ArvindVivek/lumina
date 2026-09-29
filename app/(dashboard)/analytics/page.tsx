import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Sparkles, TriangleAlert } from "lucide-react"
import { Badge, Card, EmptyState, Icon, SectionHeader } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { TeamBadge } from "@/components/lumina/team-badge"
import { UrlPicker } from "@/components/lumina/url-picker"
import { CoachTake } from "@/components/game/coach-take"
import { pct, seconds, shortDate } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listSeries } from "@/lib/data/queries"
import { mapLabel, tournamentLabel } from "@/lib/data/names"
import { buildCoachingReport } from "@/lib/analytics/coaching-report"
import { cn } from "@/lib/kl/cn"

export const metadata: Metadata = {
  title: "Match report",
  description: "One team's series, explained: opening duels, trades, post-plants and the rounds worth rewatching.",
}

type Props = { searchParams: Promise<{ series?: string; team?: string }> }

const PRIORITY = {
  critical: { tone: "danger", label: "Must watch" },
  high: { tone: "warning", label: "High" },
  medium: { tone: "accent", label: "Worth a look" },
  low: { tone: "neutral", label: "Highlight" },
} as const

export default async function MatchReportPage({ searchParams }: Props) {
  const params = await searchParams
  const db = getDb()
  const all = listSeries(db, { limit: 100 })
  const series = all.find((s) => s.id === params.series) ?? all[0]
  const teamId = params.team === series.team_a_id || params.team === series.team_b_id ? params.team : (series.winner_id ?? series.team_a_id)
  const built = await buildCoachingReport(series.id, teamId)

  const header = (
    <>
      <PageHeader
        eyebrow="Match report"
        title={`${series.team_a_name} vs ${series.team_b_name}`}
        description={`${tournamentLabel(series.tournament_name)} · ${shortDate(series.start_time)}. Everything below is from one team's side; switch sides with the buttons.`}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <UrlPicker
          label="Match"
          param="series"
          value={series.id}
          basePath="/analytics"
          className="sm:w-[26rem]"
          options={all.map((s) => ({ value: s.id, label: `${s.team_a_name} vs ${s.team_b_name} · ${shortDate(s.start_time)}` }))}
        />
        <div className="flex gap-2" role="group" aria-label="Team">
          {[
            { id: series.team_a_id, name: series.team_a_name },
            { id: series.team_b_id, name: series.team_b_name },
          ].map((t) => (
            <Link
              key={t.id}
              href={`/analytics?series=${series.id}&team=${t.id}`}
              aria-current={t.id === teamId ? "true" : undefined}
              className={cn(
                "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-[15px] font-bold",
                t.id === teamId ? "bg-accent-soft text-accent-text ring-1 ring-inset ring-accent/60" : "bg-surface-2 text-ink",
              )}
            >
              <TeamBadge name={t.name} size="sm" tone={t.id === teamId ? "accent" : "neutral"} />
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  )

  if (!built) {
    return (
      <div className="space-y-8">
        {header}
        <Card>
          <EmptyState icon={Sparkles} title="No report for this match" message="Pick another match from the list." tone="neutral" />
        </Card>
      </div>
    )
  }

  const { report, summary } = built
  const won = summary.result === "win"

  return (
    <div className="space-y-8">
      {header}

      <Card padding="lg" className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <TeamBadge name={summary.team_name} size="lg" tone="accent" />
          <p className="text-title2 text-ink">
            {summary.team_name} {won ? "won" : "lost"} <span className="tabular">{summary.score}</span> against {summary.opponent_name}
          </p>
          <Badge tone={won ? "success" : "danger"}>{won ? "Win" : "Loss"}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.maps.map((m) => (
            <Link key={m.game_id} href={`/game/${m.game_id}`} className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold", m.result === "win" ? "bg-success-soft text-success-text" : "bg-danger-soft text-danger-text")}>
              {mapLabel(m.map_name)} <span className="tabular">{m.team_score}–{m.opponent_score}</span>
            </Link>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <p className="flex gap-2 rounded-sm bg-surface-2 px-4 py-3 text-[15px] text-ink">
            <Icon icon={CheckCircle2} size={20} className="mt-0.5 shrink-0 text-success-text" />
            <span>
              <span className="font-bold">Strength: </span>
              {summary.key_strength}
            </span>
          </p>
          <p className="flex gap-2 rounded-sm bg-surface-2 px-4 py-3 text-[15px] text-ink">
            <Icon icon={TriangleAlert} size={20} className="mt-0.5 shrink-0 text-warning-text" />
            <span>
              <span className="font-bold">To fix: </span>
              {summary.key_weakness}
            </span>
          </p>
        </div>
        <CoachTake body={{ query_type: "match_review", series_id: series.id, team_focus: teamId }} label="Get the coach's review" />
      </Card>

      <section aria-labelledby="maps" className="space-y-4">
        <SectionHeader id="maps" title="Map by map" description={`From ${summary.team_name}'s side.`} />
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-extrabold">Map</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold">Score</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold" title="Share of rounds where this team got the first kill">Got first kill</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold" title="Rounds won after getting the first kill">Won after it</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold" title="Deaths a teammate avenged within 5 seconds">Deaths traded</th>
                  <th scope="col" className="px-4 py-3 text-right font-extrabold" title="Rounds won when the spike was planted">Planted rounds won</th>
                </tr>
              </thead>
              <tbody>
                {report.key_metrics.map((m) => (
                  <tr key={m.game_id} className="border-t border-line">
                    <td className="px-4 py-2.5 font-bold text-ink">
                      <Link href={`/game/${m.game_id}`} className="hover:text-accent-text">{mapLabel(m.map_name)}</Link>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{m.score}</td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{pct(m.fb_win_rate)}</td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{pct(m.fb_conversion_rate)}</td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{pct(m.trade_rate)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink">{pct(m.post_plant_win_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="duels" className="space-y-4">
          <SectionHeader id="duels" title="Opening duels" description="Who took the first fight, and what happened next." />
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-extrabold">Player</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold">Won–lost</th>
                  <th scope="col" className="px-4 py-3 text-right font-extrabold" title="Rounds won after this player's first kill">Round won after</th>
                </tr>
              </thead>
              <tbody>
                {report.opening_duels.map((d) => (
                  <tr key={d.player_id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <Link href={`/player-analytics?player=${d.player_id}`} className="font-bold text-ink hover:text-accent-text">{d.player_name}</Link>
                    </td>
                    <td className={cn("tabular px-2 py-2.5 text-right font-bold", d.net >= 0 ? "text-success-text" : "text-danger-text")}>
                      {d.first_kills}–{d.first_deaths}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink">{d.first_kills ? pct(d.fk_conversion_rate) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section aria-labelledby="patterns" className="space-y-4">
          <SectionHeader id="patterns" title="Patterns" description="Habits an opponent could read, and repeated mistakes." />
          {report.anti_strat_signals.length === 0 && report.forced_mistakes.length === 0 ? (
            <Card>
              <EmptyState icon={CheckCircle2} title="No repeated patterns" message="No player died first three times on one map, and no map had a run of isolated deaths." tone="neutral" />
            </Card>
          ) : (
            <div className="space-y-3">
              {report.anti_strat_signals.map((a) => (
                <Card key={a.signal} padding="sm" className="px-4">
                  <p className="flex items-center gap-2 font-bold text-ink">
                    <Icon icon={AlertTriangle} size={18} className="text-warning-text" />
                    {a.signal}
                  </p>
                  <p className="mt-1 text-[15px] text-ink-2">{a.detail}. {a.implication}</p>
                </Card>
              ))}
              {report.forced_mistakes.map((m) => (
                <Card key={m.mistake} padding="sm" className="px-4">
                  <p className="flex items-center gap-2 font-bold text-ink">
                    <Icon icon={AlertTriangle} size={18} className="text-danger-text" />
                    {m.mistake}
                  </p>
                  <p className="mt-1 text-[15px] text-ink-2">{m.detail}. {m.fix}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="vod" className="space-y-4">
        <SectionHeader id="vod" title="Rounds to rewatch" description="Ranked by how much each round can teach." />
        {report.vod_review_notes.length === 0 ? (
          <Card>
            <EmptyState icon={CheckCircle2} title="Nothing flagged" message="Every round went to plan." tone="neutral" />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {report.vod_review_notes.slice(0, 10).map((n) => (
              <Link key={n.round_id} href={`/game/${n.game_id}`} className="flex items-start gap-3 rounded-lg bg-surface p-4 shadow-[var(--shadow-card)] hover:bg-surface-2">
                <Badge tone={PRIORITY[n.review_priority].tone} className="shrink-0 whitespace-nowrap">{PRIORITY[n.review_priority].label}</Badge>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">
                    Map {n.game_number}, {mapLabel(n.map_name)}, round {n.round_number}
                  </span>
                  <span className="block text-[15px] text-ink-2">
                    {n.reason}
                    {n.fb_time_ms != null && ` First kill after ${seconds(n.fb_time_ms)}.`}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
