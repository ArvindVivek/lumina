"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Target } from "lucide-react"
import Link from "next/link"

interface PlayerCardProps {
  id: string
  name: string
  avatar?: string
  team?: string
  agent?: string
  stats: {
    acs: number
    kd: number
    hs: number
  }
  trend?: "up" | "down" | "neutral"
  delay?: number
}

export function PlayerCard({
  id,
  name,
  avatar,
  team,
  agent,
  stats,
  trend = "neutral",
  delay = 0,
}: PlayerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="h-full"
    >
      <Link href={`/players/${id}`}>
        <Card className="p-responsive bg-surface hover:bg-surface-hover transition-all duration-200 border border-border cursor-pointer group relative overflow-hidden h-full">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative">
            {/* Player Info */}
            <div className="flex items-start gap-3 mb-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20 flex-shrink-0">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-sm">
                    {name}
                  </h3>
                  {trend !== "neutral" && (
                    <div className={`flex-shrink-0 ${trend === "up" ? "text-status-success" : "text-status-error"}`}>
                      {trend === "up" ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                    </div>
                  )}
                </div>
                {team && (
                  <p className="text-xs text-muted-foreground truncate">{team}</p>
                )}
              </div>
            </div>

            {/* Agent Badge */}
            {agent && (
              <Badge variant="outline" className="mb-3 bg-surface-hover text-xs">
                <Target className="h-3 w-3 mr-1" />
                {agent}
              </Badge>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="text-center p-1.5 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground uppercase">LCS</p>
                <p className="text-responsive-lg font-bold text-foreground">{stats.acs}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground uppercase">K/D</p>
                <p className="text-responsive-lg font-bold text-foreground">{stats.kd}</p>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground uppercase">HS%</p>
                <p className="text-responsive-lg font-bold text-foreground">{stats.hs}%</p>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
