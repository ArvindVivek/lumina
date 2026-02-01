"use client"

import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
  delay?: number
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, scale: 1.01 }}
      className="h-full"
    >
      <Card className="p-responsive bg-surface hover:bg-surface-hover transition-all duration-200 border border-border h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p className="metric-value-responsive text-foreground mt-2">
              {value}
            </p>
            {change && (
              <p
                className={cn(
                  "text-sm font-medium mt-2 truncate",
                  changeType === "positive" && "text-status-success",
                  changeType === "negative" && "text-status-error",
                  changeType === "neutral" && "text-muted-foreground"
                )}
              >
                {change}
              </p>
            )}
          </div>
          <div className="icon-container-responsive bg-primary/10">
            <Icon className="text-primary" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
