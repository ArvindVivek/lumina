"use client"

import Link from 'next/link'
import { Users, Target, Lightbulb, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const sections = [
  {
    title: 'Player Analytics',
    description: 'Individual player performance insights including first death impact, trading efficiency, clutch performance, and agent analysis.',
    href: '/player-analytics',
    icon: Users,
    metrics: ['First Death Impact', 'Trading Efficiency', 'Opening Duels', 'Clutch Performance', 'Agent Stats', 'Multi-Kill Rounds', 'Eco Performance'],
  },
  {
    title: 'Macro Review',
    description: 'Team-level tactical analysis including pistol rounds, economy management, execution timing, and critical moment identification.',
    href: '/macro-review',
    icon: Target,
    metrics: ['Pistol Rounds', 'First Blood', 'Trade Discipline', 'Economy', 'Timing', 'Ultimates', 'Critical Moments', 'Round Breakdown'],
  },
  {
    title: 'Scenario Analysis',
    description: 'Hypothetical scenario queries with expected value calculations for save/retake, force/eco, and clutch decisions.',
    href: '/scenario-analysis',
    icon: Lightbulb,
    metrics: ['Save vs Retake', 'Force vs Eco', 'Clutch Analysis'],
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header - grid.gg style */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to{" "}
          <span className="text-valorant-red">Lumina</span>
        </h1>
        <p className="text-foreground-muted">
          Your AI-powered VALORANT coaching assistant. Analyze players, review tactics, and optimize decisions.
        </p>
      </motion.div>

      {/* Section Cards - grid.gg style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section, i) => (
          <motion.div
            key={section.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <Link href={section.href}>
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl",
                  "bg-surface border border-border",
                  "p-6 transition-all duration-300",
                  "hover:border-valorant-red/30 hover:shadow-lg hover:shadow-valorant-red/5",
                  "cursor-pointer group h-full"
                )}
              >
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-valorant-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl",
                        "bg-valorant-red/10 flex items-center justify-center"
                      )}
                    >
                      <section.icon className="w-6 h-6 text-valorant-red" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <h3 className="font-semibold text-foreground text-lg mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-foreground-muted mb-4 leading-relaxed">
                    {section.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {section.metrics.slice(0, 3).map((metric) => (
                      <span
                        key={metric}
                        className="inline-flex items-center rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-foreground-muted border border-border/50"
                      >
                        {metric}
                      </span>
                    ))}
                    {section.metrics.length > 3 && (
                      <span className="inline-flex items-center rounded-md bg-surface-hover px-2 py-1 text-xs font-medium text-foreground-muted border border-border/50">
                        +{section.metrics.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Start - grid.gg style */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-border bg-surface/50 p-6"
      >
        <h2 className="font-semibold text-sm text-valorant-red uppercase tracking-wide mb-3 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-valorant-red animate-pulse" />
          Quick Start
        </h2>
        <p className="text-sm text-foreground-muted leading-relaxed">
          Select a player or team from the filters in each section to view detailed analytics.
          All insights include confidence scores based on sample size and data quality.
        </p>
      </motion.div>
    </div>
  )
}
