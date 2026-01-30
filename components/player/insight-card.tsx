import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from './confidence-badge'

interface InsightCardProps {
  title: string
  value: string | number
  description?: string
  insight: string
  recommendation: string | null
  confidence: {
    level: 'low' | 'medium' | 'high'
    sample_size: number
    description: string
  }
  children?: React.ReactNode
}

export function InsightCard({
  title,
  value,
  description,
  insight,
  recommendation,
  confidence,
  children,
}: InsightCardProps) {
  return (
    <Card className="hover:scale-[1.02] transition-transform duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground/90">{title}</CardTitle>
          <ConfidenceBadge
            level={confidence.level}
            sampleSize={confidence.sample_size}
            description={confidence.description}
          />
        </div>
        {description && <CardDescription className="mt-1.5">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/90 to-accent bg-clip-text text-transparent">
            {value}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
          {recommendation && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
              <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <p className="text-sm text-accent font-medium leading-relaxed">
                {recommendation}
              </p>
            </div>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  )
}
