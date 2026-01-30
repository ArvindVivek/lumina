import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Users, Target, Lightbulb } from 'lucide-react'

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">
          Lumina Assistant Coach
        </h1>
        <p className="text-muted-foreground mt-2">
          Data-driven coaching insights for VALORANT. Select a section below to begin analysis.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <section.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {section.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
          Quick Start
        </h2>
        <p className="text-sm text-muted-foreground">
          Select a player or team from the filters above, then dive into specific analytics.
          All insights include confidence scores based on sample size.
        </p>
      </div>
    </div>
  )
}
