"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Users, TrendingUp } from "lucide-react"
import Link from "next/link"

interface TeamCardProps {
  id: string
  name: string
  logo?: string
  region?: string
  wins: number
  losses: number
  winRate: number
  playerCount?: number
  delay?: number
}

export function TeamCard({
  id,
  name,
  logo,
  region,
  wins,
  losses,
  winRate,
  playerCount = 5,
  delay = 0,
}: TeamCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="h-full"
    >
      <Link href={`/teams/${id}`}>
        <Card className="p-responsive bg-surface hover:bg-surface-hover transition-all duration-200 border border-border cursor-pointer group relative overflow-hidden h-full">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative">
            {/* Team Header */}
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Avatar className="h-11 w-11 border-2 border-accent/20 flex-shrink-0">
                  <AvatarImage src={logo} alt={name} />
                  <AvatarFallback className="bg-accent/10 text-accent font-bold text-sm">
                    {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-responsive-lg text-foreground group-hover:text-accent transition-colors truncate">
                    {name}
                  </h3>
                  {region && (
                    <p className="text-xs text-muted-foreground truncate">{region}</p>
                  )}
                </div>
              </div>

              <Badge variant={winRate >= 60 ? "default" : "secondary"} className="font-semibold flex-shrink-0">
                {winRate}%
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <Trophy className="h-3.5 w-3.5 text-status-success flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-sm font-bold text-foreground truncate">
                    {wins}W - {losses}L
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <Users className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Players</p>
                  <p className="text-sm font-bold text-foreground">{playerCount}</p>
                </div>
              </div>
            </div>

            {/* Performance Indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className={`h-3 w-3 flex-shrink-0 ${winRate >= 50 ? "text-status-success" : "text-status-error"}`} />
              <span className="truncate">
                {winRate >= 60 ? "Strong Performance" : winRate >= 50 ? "Above Average" : "Needs Improvement"}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
