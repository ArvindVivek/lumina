import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from '@/components/player/confidence-badge'

interface MacroCardProps {
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

export function MacroCard({
  title,
  value,
  description,
  insight,
  recommendation,
  confidence,
  children,
}: MacroCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <ConfidenceBadge
            level={confidence.level}
            sampleSize={confidence.sample_size}
            description={confidence.description}
          />
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{insight}</p>
        {recommendation && (
          <p className="text-xs text-accent mt-2 font-medium">
            → {recommendation}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
