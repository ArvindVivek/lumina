import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from '@/components/player/confidence-badge'
import { cn } from '@/lib/utils'

interface ScenarioResultProps {
  title: string
  recommendation: string | null
  confidence: {
    level: 'low' | 'medium' | 'high'
    sample_size: number
    description: string
  }
  metrics: {
    label: string
    value: string | number
    highlight?: boolean
  }[]
  insight?: string
}

export function ScenarioResult({
  title,
  recommendation,
  confidence,
  metrics,
  insight,
}: ScenarioResultProps) {
  // Determine recommendation styling
  const getRecommendationStyle = (rec: string | null) => {
    if (!rec) return 'text-muted-foreground'
    const lower = rec.toLowerCase()
    if (lower.includes('engage') || lower.includes('retake') || lower.includes('force')) {
      return 'text-primary' // Red for aggressive
    }
    if (lower.includes('save') || lower.includes('eco')) {
      return 'text-accent' // Teal for passive
    }
    return 'text-yellow-500' // Yellow for situational
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <ConfidenceBadge
            level={confidence.level}
            sampleSize={confidence.sample_size}
            description={confidence.description}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation */}
        {recommendation ? (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Recommendation
            </p>
            <p className={cn('text-lg font-bold', getRecommendationStyle(recommendation))}>
              {recommendation}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Insufficient data for recommendation
            </p>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={cn(
                'text-xl font-bold',
                metric.highlight ? 'text-primary' : 'text-foreground'
              )}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* Insight */}
        {insight && (
          <p className="text-sm text-muted-foreground border-t pt-4">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Empty state component
export function EmptyScenarioResult() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium">Enter scenario parameters</p>
        <p className="text-sm text-muted-foreground">
          Fill in the form and submit to get analysis
        </p>
      </CardContent>
    </Card>
  )
}
