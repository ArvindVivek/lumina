import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Trophy } from "lucide-react"
import { Badge, Icon } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { TeamBadge } from "@/components/lumina/team-badge"
import { dateRange } from "@/components/lumina/format"
import { getDb } from "@/lib/data"
import { listTournaments } from "@/lib/data/queries"
import { tournamentLabel } from "@/lib/data/names"

export const metadata: Metadata = {
  title: "Tournaments",
  description: "VCT Americas playoff brackets from 2024 and 2025, match by match.",
}

export default function TournamentsPage() {
  const tournaments = listTournaments(getDb())
  return (
    <div className="space-y-8">
      <PageHeader title="Tournaments" description="Three VCT Americas playoff brackets. Open one to see every match." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="group flex flex-col rounded-lg bg-surface p-5 shadow-[var(--shadow-card)] transition-colors duration-75 hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-md bg-accent-soft text-accent-text">
                <Icon icon={Trophy} size={22} />
              </span>
              <Badge tone="neutral">{t.start_date?.slice(0, 4)}</Badge>
            </div>
            <h2 className="mt-4 text-title2 text-ink">{tournamentLabel(t.name)}</h2>
            <p className="mt-1 text-[15px] text-ink-2">{dateRange(t.start_date, t.end_date)}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Matches", t.series_count],
                ["Maps", t.game_count],
                ["Teams", t.team_count],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse rounded-sm bg-surface-2 py-2">
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">{label}</dt>
                  <dd className="tabular font-display text-title3 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {t.champion_name && (
              <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[15px] text-ink">
                <TeamBadge name={t.champion_name} size="sm" tone="win" />
                <span className="font-bold">{t.champion_name}</span>
                <span className="text-ink-2">won the final</span>
                <Icon icon={ChevronRight} size={18} className="ml-auto text-ink-2" />
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
