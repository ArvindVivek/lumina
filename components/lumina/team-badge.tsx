import { cn } from "@/lib/kl/cn"
import { teamCode } from "@/lib/data/names"

const SIZES = {
  sm: "h-7 min-w-9 px-1.5 text-[11px]",
  md: "h-9 min-w-11 px-2 text-xs",
  lg: "h-12 min-w-14 px-2.5 text-sm",
} as const

/**
 * A team's short code in a plain tile ("C9", "SEN"). Team logos belong to the teams and aren't
 * covered by Riot's fan-content policy, so Lumina never shows them.
 */
export function TeamBadge({ name, size = "md", tone = "neutral", className }: {
  name: string
  size?: keyof typeof SIZES
  tone?: "neutral" | "win" | "accent"
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm font-display font-semibold leading-none tracking-wide",
        tone === "win" && "bg-success-soft text-success-text",
        tone === "accent" && "bg-accent-soft text-accent-text",
        tone === "neutral" && "bg-surface-2 text-ink ring-1 ring-inset ring-line",
        SIZES[size],
        className,
      )}
    >
      {teamCode(name)}
    </span>
  )
}
