import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ConfidenceBadgeProps {
  level: 'low' | 'medium' | 'high'
  sampleSize: number
  description: string
}

const confidenceStyles = {
  low: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-green-500/10 text-green-500 border-green-500/20',
}

export function ConfidenceBadge({ level, sampleSize, description }: ConfidenceBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={confidenceStyles[level]}>
            {level.toUpperCase()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Sample size: {sampleSize}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
