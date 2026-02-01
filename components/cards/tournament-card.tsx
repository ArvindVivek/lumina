"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Calendar, Users, MapPin } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface TournamentCardProps {
  id: string
  name: string
  region: string
  startDate: string
  endDate?: string
  status: "upcoming" | "ongoing" | "completed"
  teamCount: number
  prizePool?: string
  delay?: number
}

export function TournamentCard({
  id,
  name,
  region,
  startDate,
  endDate,
  status,
  teamCount,
  prizePool,
  delay = 0,
}: TournamentCardProps) {
  const statusColors = {
    upcoming: "bg-accent/10 text-accent border-accent/20",
    ongoing: "bg-status-error/10 text-status-error border-status-error/20 animate-pulse",
    completed: "bg-muted text-muted-foreground border-muted",
  }

  const statusLabels = {
    upcoming: "Upcoming",
    ongoing: "Live",
    completed: "Completed",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="h-full"
    >
      <Link href={`/tournaments/${id}`}>
        <Card className="p-responsive bg-surface hover:bg-surface-hover transition-all duration-200 border border-border cursor-pointer group relative overflow-hidden h-full">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="icon-container-responsive bg-primary/10">
                  <Trophy className="text-primary" />
                </div>
                <Badge className={cn("border text-xs", statusColors[status])}>
                  {statusLabels[status]}
                </Badge>
              </div>
            </div>

            {/* Tournament Info */}
            <div className="flex-1">
              <h3 className="font-bold text-responsive-lg text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                {name}
              </h3>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{region}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {startDate}
                    {endDate && ` - ${endDate}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{teamCount} Teams</span>
                </div>
              </div>
            </div>

            {/* Prize Pool */}
            {prizePool && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase mb-1">Prize Pool</p>
                <p className="text-responsive-lg font-bold text-accent">{prizePool}</p>
              </div>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
