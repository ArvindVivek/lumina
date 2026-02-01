import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from '@/components/player/confidence-badge'
import { LucideIcon } from 'lucide-react'

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
  icon?: LucideIcon
  iconColor?: string
  children?: React.ReactNode
}

export function MacroCard({
  title,
  value,
  description,
  insight,
  recommendation,
  confidence,
  icon: Icon,
  iconColor = "text-primary",
  children,
}: MacroCardProps) {
  return (
    <Card className="hover:scale-[1.01] transition-transform duration-300 h-full">
      <CardHeader className="pb-2 p-responsive">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <div className={`icon-container-responsive bg-primary/10 ${iconColor}`}>
                <Icon />
              </div>
            )}
            <CardTitle className="text-responsive-lg font-semibold text-foreground/90 truncate">{title}</CardTitle>
          </div>
          <ConfidenceBadge
            level={confidence.level}
            sampleSize={confidence.sample_size}
            description={confidence.description}
          />
        </div>
        {description && <CardDescription className="mt-1.5 text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-responsive pt-0">
        <div className="space-y-responsive">
          <div className="metric-value-responsive bg-gradient-to-r from-primary via-primary/90 to-accent bg-clip-text text-transparent">
            {value}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
          {recommendation && (
            <div className="flex items-start gap-2 p-responsive rounded-lg bg-accent/10 border border-accent/20">
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
