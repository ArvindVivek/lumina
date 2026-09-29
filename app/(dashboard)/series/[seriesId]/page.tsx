import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Sparkles } from "lucide-react"
import { Button, Card, Icon, SectionHeader } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { Scoreboard } from "@/components/lumina/scoreboard"
import { TeamBadge } from "@/components/lumina/team-badge"
import { formatLabel, shortDate } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { scoreboard, seriesRow } from "@/lib/data/queries"
import { mapLabel, tournamentLabel } from "@/lib/data/names"
import { cn } from "@/lib/kl/cn"

type Props = { params: Promise<{ seriesId: string }> }

export function generateStaticParams() {
  return getDb().series.map((s) => ({ seriesId: s.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = getDb()
  const s = db.seriesById.get((await params).seriesId)
  if (!s) return { title: "Match not found" }
  const row = seriesRow(db, s)
  return { title: `${row.team_a_name} vs ${row.team_b_name}`, description: `${row.team_a_name} ${row.team_a_score}-${row.team_b_score} ${row.team_b_name}, ${tournamentLabel(row.tournament_name)}.` }
}

export default async function SeriesPage({ params }: Props) {
  const { seriesId } = await params
  const db = getDb()
  const series = db.seriesById.get(seriesId)
  if (!series) notFound()
  const s = seriesRow(db, series)
  const games = db.gamesBySeries.get(seriesId) ?? []
  const aWon = s.winner_id === s.team_a_id

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/tournaments/${s.tournament_id}`, label: tournamentLabel(s.tournament_name) }}
        eyebrow={`${formatLabel(s.format)} · ${shortDate(s.start_time)}`}
        title={`${s.team_a_name} vs ${s.team_b_name}`}
        actions={
          <Button href={`/analytics?series=${s.id}&team=${s.winner_id ?? s.team_a_id}`} icon={Sparkles} size="sm">
            Match report
          </Button>
        }
      />

      <Card padding="lg">
        <div className="flex items-center justify-center gap-4 sm:gap-10">
          {[
            { name: s.team_a_name, score: s.team_a_score, won: aWon },
            { name: s.team_b_name, score: s.team_b_score, won: !aWon },
          ].map((t, i) => (
            <div key={t.name} className={cn("flex min-w-0 flex-1 items-center gap-3 sm:gap-4", i === 0 ? "justify-end" : "flex-row-reverse justify-end")}>
              <div className={cn("min-w-0 max-sm:sr-only", i === 0 ? "text-right" : "text-left")}>
                <p className="truncate font-bold text-ink">{t.name}</p>
                {t.won && <p className="text-sm font-bold text-success-text">Winner</p>}
              </div>
              <TeamBadge name={t.name} size="lg" tone={t.won ? "win" : "neutral"} />
              <span className={cn("tabular font-display text-hero", t.won ? "text-success-text" : "text-ink-2")}>{t.score}</span>
            </div>
          ))}
        </div>
      </Card>

      <section aria-labelledby="maps" className="space-y-4">
        <SectionHeader id="maps" title="Maps" description="Open a map for its round-by-round story." />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => {
            const winner = g.winner_id === s.team_a_id ? s.team_a_name : s.team_b_name
            return (
              <Link key={g.id} href={`/game/${g.id}`} className="group rounded-lg bg-surface p-5 shadow-[var(--shadow-card)] transition-colors duration-75 hover:bg-surface-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-2">Map {g.sequence_number}</p>
                <div className="mt-1 flex items-center justify-between">
                  <h3 className="text-title2 text-ink">{mapLabel(g.map_name)}</h3>
                  <Icon icon={ChevronRight} size={20} className="text-ink-2 transition-transform duration-75 group-hover:translate-x-0.5" />
                </div>
                <p className="mt-3 flex items-center gap-2">
                  <TeamBadge name={s.team_a_name} size="sm" tone={g.winner_id === s.team_a_id ? "win" : "neutral"} />
                  <span className="tabular font-display text-title text-ink">
                    {g.team_a_score} – {g.team_b_score}
                  </span>
                  <TeamBadge name={s.team_b_name} size="sm" tone={g.winner_id === s.team_b_id ? "win" : "neutral"} />
                </p>
                <p className="mt-1 text-[15px] text-ink-2">
                  <span className="font-bold text-success-text">{winner}</span> took it
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="board" className="space-y-4">
        <SectionHeader id="board" title="Series scoreboard" description="All maps combined." />
        <Scoreboard
          lines={scoreboard(db, games)}
          teams={[
            { id: s.team_a_id, name: s.team_a_name, won: aWon },
            { id: s.team_b_id, name: s.team_b_name, won: !aWon },
          ]}
        />
      </section>
    </div>
  )
}
