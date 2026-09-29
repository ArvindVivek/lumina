import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Icon } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { TeamBadge } from "@/components/lumina/team-badge"
import { pct } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listTeams } from "@/lib/data/queries"

export const metadata: Metadata = {
  title: "Teams",
  description: "The ten VCT Americas teams in the sample: records, round win rates and rosters.",
}

export default function TeamsPage() {
  const teams = listTeams(getDb())
  return (
    <div className="space-y-8">
      <PageHeader title="Teams" description="Records across the three playoff brackets. Open a team for its full review." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <Link
            key={t.id}
            href={`/macro-review?team=${t.id}`}
            className="group flex flex-col rounded-lg bg-surface p-5 shadow-[var(--shadow-card)] transition-colors duration-75 hover:bg-surface-2"
          >
            <div className="flex items-center gap-4">
              <TeamBadge name={t.name} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-title2 text-ink">{t.name}</h2>
                <p className="text-[15px] text-ink-2">
                  {t.series_won}–{t.series_played - t.series_won} in series · {t.maps_won}–{t.maps_lost} in maps
                </p>
              </div>
              <Icon icon={ChevronRight} size={20} className="text-ink-2 transition-transform duration-75 group-hover:translate-x-0.5" />
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="text-ink-2">Rounds won</span>
                <span className="tabular font-display text-title3 text-ink">{pct(t.round_win_rate)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: pct(t.round_win_rate, 1) }} />
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-2">
              <span className="font-bold text-ink">Latest roster: </span>
              {t.roster.join(", ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
