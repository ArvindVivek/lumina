import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Badge, Card, Icon } from "@/components/kl"
import type { ConfidenceScore } from "@/lib/analytics/types"

const CONFIDENCE = {
  high: { tone: "success", label: "Solid sample" },
  medium: { tone: "warning", label: "Small sample" },
  low: { tone: "neutral", label: "Too few to judge" },
} as const

/** How much to trust a number, in words, with the sample size. */
export function ConfidenceBadge({ confidence }: { confidence: ConfidenceScore }) {
  const c = CONFIDENCE[confidence.level]
  return (
    <span title={confidence.description} className="inline-flex items-center gap-2">
      <Badge tone={c.tone}>{c.label}</Badge>
      <span className="text-[13px] text-ink-2">n = {confidence.sample_size}</span>
    </span>
  )
}

/**
 * One metric with its meaning: the number, what it counts, a plain-English reading and, when
 * there is one, what to do about it.
 */
export function InsightCard({ title, value, description, insight, recommendation, confidence, icon }: {
  title: string
  value: ReactNode
  description: string
  insight: string
  recommendation: string | null
  confidence: ConfidenceScore
  icon?: LucideIcon
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-title3 text-ink">
          {icon && <Icon icon={icon} size={18} className="text-accent-text" />}
          {title}
        </h3>
      </div>
      <div>
        <p className="tabular font-display text-number text-ink">{value}</p>
        <p className="text-[15px] text-ink-2">{description}</p>
      </div>
      <p className="text-[15px] text-ink">{insight}</p>
      {recommendation && (
        <p className="rounded-sm bg-surface-2 px-3 py-2 text-[15px] text-ink">
          <span className="font-bold">Try: </span>
          {recommendation}
        </p>
      )}
      <div className="mt-auto pt-1">
        <ConfidenceBadge confidence={confidence} />
      </div>
    </Card>
  )
}
