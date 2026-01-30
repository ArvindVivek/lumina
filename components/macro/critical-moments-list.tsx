import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PriorityBadge } from './priority-badge'

interface CriticalMoment {
  round_number: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number
  factors: {
    round_impact: number
    pattern_deviation: number
    economic_consequence: number
  }
  context: {
    round_outcome: string
    economy_state: string
    score_before: string
  }
}

interface CriticalMomentsListProps {
  moments: CriticalMoment[]
  teamName?: string
}

export function CriticalMomentsList({ moments, teamName }: CriticalMomentsListProps) {
  if (!moments || moments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Critical Moments</CardTitle>
          <CardDescription>Rounds requiring VOD review</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No critical moments identified.</p>
        </CardContent>
      </Card>
    )
  }

  // Group by priority
  const highPriority = moments.filter(m => m.priority === 'HIGH')
  const mediumPriority = moments.filter(m => m.priority === 'MEDIUM')

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Critical Moments for VOD Review</CardTitle>
        <CardDescription>
          {moments.length} moments identified ({highPriority.length} HIGH, {mediumPriority.length} MEDIUM priority)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {highPriority.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                High Priority
              </h4>
              <div className="space-y-2">
                {highPriority.slice(0, 5).map((moment) => (
                  <MomentRow key={moment.round_number} moment={moment} />
                ))}
              </div>
            </div>
          )}

          {mediumPriority.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Medium Priority
              </h4>
              <div className="space-y-2">
                {mediumPriority.slice(0, 5).map((moment) => (
                  <MomentRow key={moment.round_number} moment={moment} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MomentRow({ moment }: { moment: CriticalMoment }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <PriorityBadge priority={moment.priority} />
        <div>
          <p className="text-sm font-medium">Round {moment.round_number}</p>
          <p className="text-xs text-muted-foreground">
            {moment.context.round_outcome} | {moment.context.economy_state} | Score: {moment.context.score_before}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          Impact: {moment.factors.round_impact.toFixed(1)} |
          Deviation: {moment.factors.pattern_deviation.toFixed(1)} |
          Econ: {moment.factors.economic_consequence.toFixed(1)}
        </p>
      </div>
    </div>
  )
}
