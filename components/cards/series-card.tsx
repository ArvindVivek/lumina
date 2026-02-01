"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy } from "lucide-react"
import Link from "next/link"

interface SeriesCardProps {
  id: string
  teamA: {
    name: string
    logo?: string
    score: number
  }
  teamB: {
    name: string
    logo?: string
    score: number
  }
  tournament: string
  date: string
  isLive?: boolean
  delay?: number
}

export function SeriesCard({
  id,
  teamA,
  teamB,
  tournament,
  date,
  isLive,
  delay = 0,
}: SeriesCardProps) {
  const winner = teamA.score > teamB.score ? "A" : teamB.score > teamA.score ? "B" : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="h-full"
    >
      <Link href={`/series/${id}`}>
        <Card className="p-responsive bg-surface hover:bg-surface-hover transition-all duration-200 border border-border cursor-pointer group h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Trophy className="h-4 w-4 text-accent flex-shrink-0" />
              <span className="text-sm font-medium text-muted-foreground truncate">{tournament}</span>
            </div>
            {isLive && (
              <Badge variant="destructive" className="animate-pulse flex-shrink-0">
                LIVE
              </Badge>
            )}
          </div>

          {/* Teams */}
          <div className="space-y-2">
            {/* Team A */}
            <div className={`flex items-center justify-between p-2 rounded-lg gap-2 ${winner === "A" ? "bg-primary/10" : "bg-background/50"}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={teamA.logo} alt={teamA.name} />
                  <AvatarFallback className="text-xs">{teamA.name[0]}</AvatarFallback>
                </Avatar>
                <span className={`font-semibold text-sm truncate ${winner === "A" ? "text-primary" : "text-foreground"}`}>
                  {teamA.name}
                </span>
              </div>
              <span className={`text-responsive-xl font-bold tabular-nums flex-shrink-0 ${winner === "A" ? "text-primary" : "text-muted-foreground"}`}>
                {teamA.score}
              </span>
            </div>

            {/* Team B */}
            <div className={`flex items-center justify-between p-2 rounded-lg gap-2 ${winner === "B" ? "bg-primary/10" : "bg-background/50"}`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={teamB.logo} alt={teamB.name} />
                  <AvatarFallback className="text-xs">{teamB.name[0]}</AvatarFallback>
                </Avatar>
                <span className={`font-semibold text-sm truncate ${winner === "B" ? "text-primary" : "text-foreground"}`}>
                  {teamB.name}
                </span>
              </div>
              <span className={`text-responsive-xl font-bold tabular-nums flex-shrink-0 ${winner === "B" ? "text-primary" : "text-muted-foreground"}`}>
                {teamB.score}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 text-xs text-muted-foreground">
            {date}
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
