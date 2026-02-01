"use client"

import { cn } from "@/lib/utils"
import { CompactMetric } from "./compact-metric"

interface Metric {
  label: string
  value: string | number
  change?: {
    value: string | number
    direction: "up" | "down" | "neutral"
    label?: string
  }
  context?: string
  status?: "win" | "loss" | "warning" | "neutral"
}

interface MetricRowProps {
  metrics: Metric[]
  className?: string
}

export function MetricRow({ metrics, className }: MetricRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        metrics.length === 2 && "grid-cols-2",
        metrics.length === 3 && "grid-cols-3",
        metrics.length === 4 && "grid-cols-4",
        metrics.length > 4 && "grid-cols-4",
        className
      )}
    >
      {metrics.slice(0, 4).map((metric, index) => (
        <CompactMetric key={index} {...metric} />
      ))}
    </div>
  )
}
