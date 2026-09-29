import type { Metadata } from "next"
import { Database } from "lucide-react"
import { Card, SectionHeader } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { dateRange } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { datasetStats, listTournaments } from "@/lib/data/queries"
import { tournamentLabel } from "@/lib/data/names"

export const metadata: Metadata = {
  title: "About the data",
  description: "Where Lumina's match data comes from and what it covers.",
}

const TABLE_LABELS: [keyof ReturnType<typeof datasetStats>, string][] = [
  ["tournaments", "Tournaments"],
  ["series", "Series"],
  ["games", "Maps"],
  ["rounds", "Rounds"],
  ["teams", "Teams"],
  ["players", "Players"],
  ["killEvents", "Kills"],
  ["clutchSituations", "Clutch situations"],
]

/** What's bundled and how it was built. (This route was the hackathon's database check page.) */
export default function DataPage() {
  const db = getDb()
  const stats = datasetStats(db)
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Data check"
        title="About the data"
        description="Everything in Lumina is computed from one bundled file of real pro matches. Nothing is live and nothing you do here is stored."
      />
      <Card>
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-text">
            <Database size={22} aria-hidden="true" />
          </span>
          <div className="space-y-2 text-[15px] text-ink">
            <p>
              The matches come from GRID&apos;s official VALORANT esports feed, which logs every kill, plant and buy. Lumina&apos;s build
              script replays those logs and keeps what the analysis needs: who was alive, who spent what, who died first and who
              traded. Damage and spike sites aren&apos;t in the feed, so Lumina doesn&apos;t show them.
            </p>
            <p className="text-ink-2">Built from {db.series.length} series. The file is about 2 MB and ships with the app.</p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="counts" className="space-y-4">
        <SectionHeader id="counts" title="What's included" />
        <Card padding="none" className="overflow-hidden">
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {TABLE_LABELS.map(([key, label]) => (
              <div key={key} className="flex flex-col-reverse border-b border-r border-line px-4 py-3">
                <dt className="text-[13px] text-ink-2">{label}</dt>
                <dd className="tabular font-display text-title2 text-ink">{stats[key].toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
      <section aria-labelledby="brackets" className="space-y-4">
        <SectionHeader id="brackets" title="Brackets" />
        <ul className="space-y-2">
          {listTournaments(db).map((t) => (
            <li key={t.id}>
              <Card padding="sm" className="flex flex-wrap items-baseline justify-between gap-2 px-4">
                <span className="font-bold text-ink">{tournamentLabel(t.name)}</span>
                <span className="text-[15px] text-ink-2">
                  {dateRange(t.start_date, t.end_date)} · {t.series_count} series
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
