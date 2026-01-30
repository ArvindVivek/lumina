import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { InfoIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  level: 'low' | 'medium' | 'high'
  sampleSize: number
  description: string
}

const levelColors = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-red-500',
}

const levelLabels = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

export function ConfidenceBadge({ level, sampleSize, description }: ConfidenceBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1">
            <InfoIcon className={cn('h-4 w-4', levelColors[level])} />
            <span className={cn('text-xs font-medium', levelColors[level])}>
              {levelLabels[level]}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{levelLabels[level]} (n={sampleSize})</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
