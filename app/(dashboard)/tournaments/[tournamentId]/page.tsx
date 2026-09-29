import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Map as MapIcon, Swords, Trophy, Users } from "lucide-react"
import { SectionHeader, StatTile } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { SeriesCard } from "@/components/lumina/series-card"
import { dateRange } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listSeries, listTournaments } from "@/lib/data/queries"
import { tournamentLabel } from "@/lib/data/names"

type Props = { params: Promise<{ tournamentId: string }> }

export function generateStaticParams() {
  return getDb().tournaments.map((t) => ({ tournamentId: t.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getDb().tournament.get((await params).tournamentId)
  return t ? { title: tournamentLabel(t.name), description: `Every match of ${tournamentLabel(t.name)}.` } : { title: "Tournament not found" }
}

export default async function TournamentPage({ params }: Props) {
  const { tournamentId } = await params
  const db = getDb()
  const t = listTournaments(db).find((x) => x.id === tournamentId)
  if (!t) notFound()
  const series = listSeries(db, { tournamentId })

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/tournaments", label: "Tournaments" }}
        eyebrow={dateRange(t.start_date, t.end_date)}
        title={tournamentLabel(t.name)}
        description={t.champion_name ? `${t.champion_name} won the final. Open a match for its maps, scoreboard and rounds.` : undefined}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Swords} value={t.series_count} label="Matches" />
        <StatTile icon={MapIcon} value={t.game_count} label="Maps" />
        <StatTile icon={Users} value={t.team_count} label="Teams" />
        <StatTile icon={Trophy} value={t.champion_name ?? "–"} label="Champion" />
      </div>
      <section aria-labelledby="matches" className="space-y-4">
        <SectionHeader id="matches" title="Matches" description="Newest first" />
        <div className="space-y-3">
          {series.map((s) => (
            <SeriesCard key={s.id} s={s} showTournament={false} />
          ))}
        </div>
      </section>
    </div>
  )
}
