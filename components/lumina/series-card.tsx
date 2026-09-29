import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Icon } from "@/components/kl"
import { cn } from "@/lib/kl/cn"
import { mapLabel, tournamentLabel } from "@/lib/data/names"
import type { SeriesRow } from "@/lib/data/queries"
import { TeamBadge } from "./team-badge"
import { formatLabel, shortDate } from "./format"

function Side({ name, score, won, align }: { name: string; score: number; won: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      <TeamBadge name={name} tone={won ? "win" : "neutral"} />
      <span className={cn("min-w-0 truncate text-[15px] font-bold sm:text-base", won ? "text-ink" : "text-ink-2")}>{name}</span>
      <span className={cn("tabular ml-auto font-display text-title2", align === "right" && "ml-0 mr-auto", won ? "text-success-text" : "text-ink-2")}>
        {score}
      </span>
    </div>
  )
}

/** One series as a tappable row: both teams with badges, the map score, maps and date. */
export function SeriesCard({ s, showTournament = true }: { s: SeriesRow; showTournament?: boolean }) {
  return (
    <Link
      href={`/series/${s.id}`}
      className="group block rounded-lg bg-surface p-4 shadow-[var(--shadow-card)] transition-colors duration-75 hover:bg-surface-2 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Side name={s.team_a_name} score={s.team_a_score} won={s.winner_id === s.team_a_id} align="left" />
          <span className="hidden text-sm font-bold text-ink-2 sm:block">vs</span>
          <Side name={s.team_b_name} score={s.team_b_score} won={s.winner_id === s.team_b_id} align="left" />
        </div>
        <Icon icon={ChevronRight} size={20} className="shrink-0 text-ink-2 transition-transform duration-75 group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-sm text-ink-2">
        {showTournament && <>{tournamentLabel(s.tournament_name)} · </>}
        {formatLabel(s.format)} · {s.maps.map(mapLabel).join(", ")} · {shortDate(s.start_time)}
      </p>
    </Link>
  )
}
