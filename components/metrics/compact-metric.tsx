"use client"

import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

interface CompactMetricProps {
  label: string
  value: string | number
  change?: {
    value: string | number
    direction: "up" | "down" | "neutral"
    label?: string
  }
  context?: string
  status?: "win" | "loss" | "warning" | "neutral"
  className?: string
}

export function CompactMetric({
  label,
  value,
  change,
  context,
  status,
  className,
}: CompactMetricProps) {
  return (
    <div className={cn("metric-compact", className)}>
      <div className="metric-label">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div
          className={cn(
            "metric-value",
            status === "win" && "text-win",
            status === "loss" && "text-loss",
            status === "warning" && "text-warning"
          )}
        >
          {value}
        </div>
        {change && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-sm font-medium",
              change.direction === "up" && "text-win",
              change.direction === "down" && "text-loss",
              change.direction === "neutral" && "text-text-tertiary"
            )}
          >
            {change.direction === "up" && <ArrowUp className="h-3 w-3" />}
            {change.direction === "down" && <ArrowDown className="h-3 w-3" />}
            <span>{change.value}</span>
          </div>
        )}
      </div>
      {context && <div className="metric-context mt-1">{context}</div>}
    </div>
  )
}
