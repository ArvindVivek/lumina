import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

const priorityStyles = {
  HIGH: 'bg-red-500/10 text-red-500 border-red-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        priorityStyles[priority]
      )}
    >
      {priority}
    </span>
  )
}
