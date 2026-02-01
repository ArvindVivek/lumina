"use client"

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Users, TrendingUp, Target, BarChart3, Crosshair, Swords, Zap, Database, UserCircle } from 'lucide-react'
import { useStats } from '@/lib/hooks/use-stats'
import { usePushScreenData } from '@/lib/hooks/use-screen-data'

// Animated counter component
function AnimatedCounter({
  value,
  duration = 2000,
  suffix = '',
  delay = 0
}: {
  value: number
  duration?: number
  suffix?: string
  delay?: number
}) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (value === 0) return

    // Wait for delay before starting animation
    const delayTimeout = setTimeout(() => {
      setHasStarted(true)
      const startTime = Date.now()
      const endValue = value

      const animate = () => {
        const now = Date.now()
        const progress = Math.min((now - startTime) / duration, 1)
        // Easing function for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.floor(eased * endValue))

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(delayTimeout)
  }, [value, duration, delay])

  return <span>{count.toLocaleString()}{suffix}</span>
}

// Stat card with animation
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay = 0
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="panel-responsive relative overflow-hidden group hover:border-valorant-accent/30 transition-colors"
    >
      {/* Background glow effect */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${color}`}
        style={{ filter: 'blur(40px)' }}
      />

      <div className="relative flex items-start gap-3">
        <div className={`icon-container-responsive ${color}`}>
          <Icon className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-text-secondary mb-1 truncate">{label}</p>
          <p className="metric-value-responsive text-text-primary tabular-nums">
            <AnimatedCounter value={value} delay={delay * 1000} />
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats()

  // Memoize the data object to avoid re-renders
  const screenData = useMemo(() => {
    if (!stats) return null
    return {
      tournaments: stats.tournaments,
      teams: stats.teams,
      players: stats.players,
      matches: stats.series,
      games: stats.games,
      rounds: stats.rounds,
      killEvents: stats.killEvents,
      clutchSituations: stats.clutchSituations,
    }
  }, [stats])

  // Push dashboard stats to screen context for chat
  usePushScreenData('Dashboard Statistics', screenData, !isLoading && !!stats)

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-responsive p-responsive space-y-responsive">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-2"
        >
          <h1 className="text-responsive-4xl font-bold text-text-primary">
            VALORANT <span className="text-valorant-accent">Analytics</span>
          </h1>
          <p className="text-responsive-lg text-text-secondary">
            AI-powered coaching insights for competitive VALORANT
          </p>
        </motion.div>

        {/* Data Statistics with Animations */}
        <div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm uppercase tracking-wider text-text-tertiary mb-4 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Available Data
          </motion.h2>

          {isLoading ? (
            <div className="grid-responsive-stats">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="panel-responsive animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="icon-container-responsive bg-surface-hover" />
                    <div className="flex-1">
                      <div className="h-3 w-16 bg-surface-hover rounded mb-2" />
                      <div className="h-8 w-24 bg-surface-hover rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid-responsive-stats">
              <StatCard
                icon={Trophy}
                label="Tournaments"
                value={stats?.tournaments || 0}
                color="bg-valorant-accent"
                delay={0}
              />
              <StatCard
                icon={Users}
                label="Teams"
                value={stats?.teams || 0}
                color="bg-chart-defense"
                delay={0.1}
              />
              <StatCard
                icon={UserCircle}
                label="Players"
                value={stats?.players || 0}
                color="bg-chart-attack"
                delay={0.2}
              />
              <StatCard
                icon={Swords}
                label="Matches"
                value={stats?.series || 0}
                color="bg-valorant-red"
                delay={0.3}
              />
              <StatCard
                icon={Target}
                label="Games Played"
                value={stats?.games || 0}
                color="bg-purple-600"
                delay={0.4}
              />
              <StatCard
                icon={BarChart3}
                label="Rounds"
                value={stats?.rounds || 0}
                color="bg-blue-600"
                delay={0.5}
              />
              <StatCard
                icon={Crosshair}
                label="Kill Events"
                value={stats?.killEvents || 0}
                color="bg-orange-600"
                delay={0.6}
              />
              <StatCard
                icon={Zap}
                label="Clutch Situations"
                value={stats?.clutchSituations || 0}
                color="bg-yellow-600"
                delay={0.7}
              />
            </div>
          )}
        </div>

        {/* Quick Access */}
        <div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-responsive-2xl font-semibold text-text-primary mb-4"
          >
            Quick Access
          </motion.h2>
          <div className="grid-responsive-cards">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <Link href="/player-analytics">
                <div className="panel-responsive group cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="icon-container-responsive bg-valorant-accent/10 group-hover:bg-valorant-accent/20 transition-colors">
                      <Users className="text-valorant-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary mb-1 text-responsive-lg">Player Analytics</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Deep dive into individual performance, trading efficiency, and clutch stats
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
            >
              <Link href="/macro-review">
                <div className="panel-responsive group cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="icon-container-responsive bg-chart-defense/10 group-hover:bg-chart-defense/20 transition-colors">
                      <Target className="text-chart-defense" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary mb-1 text-responsive-lg">Macro Review</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Team tactics, economy management, and critical moment analysis
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              <Link href="/scenario-analysis">
                <div className="panel-responsive group cursor-pointer h-full">
                  <div className="flex items-start gap-3">
                    <div className="icon-container-responsive bg-chart-attack/10 group-hover:bg-chart-attack/20 transition-colors">
                      <BarChart3 className="text-chart-attack" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary mb-1 text-responsive-lg">Scenario Analysis</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Save vs retake, force buy decisions, and clutch scenario insights
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Browse Data Section */}
        <div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-responsive-2xl font-semibold text-text-primary mb-4"
          >
            Browse Data
          </motion.h2>
          <div className="grid-responsive-cards">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
            >
              <Link href="/tournaments">
                <div className="panel-responsive group cursor-pointer text-center">
                  <div className="icon-container-responsive bg-valorant-accent/10 mx-auto mb-3">
                    <Trophy className="text-valorant-accent" />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">Tournaments</h3>
                  <p className="text-sm text-text-secondary">
                    <AnimatedCounter value={stats?.tournaments || 0} /> tournaments
                  </p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
            >
              <Link href="/teams">
                <div className="panel-responsive group cursor-pointer text-center">
                  <div className="icon-container-responsive bg-chart-defense/10 mx-auto mb-3">
                    <Users className="text-chart-defense" />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">Teams</h3>
                  <p className="text-sm text-text-secondary">
                    <AnimatedCounter value={stats?.teams || 0} /> teams
                  </p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
            >
              <Link href="/players">
                <div className="panel-responsive group cursor-pointer text-center">
                  <div className="icon-container-responsive bg-chart-attack/10 mx-auto mb-3">
                    <TrendingUp className="text-chart-attack" />
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">Players</h3>
                  <p className="text-sm text-text-secondary">
                    <AnimatedCounter value={stats?.players || 0} /> players
                  </p>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
