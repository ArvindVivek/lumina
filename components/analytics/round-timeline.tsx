"use client"

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface RoundData {
  round_id: string
  round_number: number
  map_name: string
  game_id: string
  won?: boolean
  side?: 'attack' | 'defense'
}

interface RoundTimelineProps {
  rounds: RoundData[]
  selectedRoundId?: string | null
  onRoundSelect?: (roundId: string) => void
  groupByMap?: boolean
}

export function RoundTimeline({
  rounds,
  selectedRoundId,
  onRoundSelect,
  groupByMap = true,
}: RoundTimelineProps) {
  // Group rounds by map if enabled
  const groupedRounds = groupByMap
    ? rounds.reduce((acc, round) => {
        const key = `${round.map_name}-${round.game_id}`
        if (!acc[key]) {
          acc[key] = {
            map_name: round.map_name,
            game_id: round.game_id,
            rounds: [],
          }
        }
        acc[key].rounds.push(round)
        return acc
      }, {} as Record<string, { map_name: string; game_id: string; rounds: RoundData[] }>)
    : null

  if (groupByMap && groupedRounds) {
    return (
      <div className="space-y-3">
        {Object.values(groupedRounds).map((group) => (
          <div key={`${group.map_name}-${group.game_id}`} className="space-y-2">
            {/* Map Header */}
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{group.map_name}</h4>
              <Badge variant="outline" className="text-[10px] h-5">
                {group.rounds.length}r
              </Badge>
            </div>

            {/* Round Timeline - Compact */}
            <ScrollArea className="w-full">
              <div className="flex gap-1 pb-1">
                {group.rounds.map((round) => {
                  const isSelected = selectedRoundId === round.round_id
                  const isClickable = !!onRoundSelect

                  return (
                    <motion.button
                      key={round.round_id}
                      onClick={() => isClickable && onRoundSelect(round.round_id)}
                      disabled={!isClickable}
                      className={cn(
                        "relative flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all",
                        "min-w-[44px]",
                        isClickable && "hover:shadow cursor-pointer",
                        !isClickable && "cursor-default",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border/60 bg-muted/30 hover:border-primary/40"
                      )}
                      whileHover={isClickable ? { scale: 1.02 } : {}}
                      whileTap={isClickable ? { scale: 0.98 } : {}}
                    >
                      {/* Round Number */}
                      <div className="text-[10px] font-medium text-muted-foreground">
                        R{round.round_number}
                      </div>

                      {/* Win/Loss Indicator */}
                      <div
                        className={cn(
                          "w-7 h-7 rounded flex items-center justify-center font-bold text-xs",
                          round.won === true && "bg-green-500/20 text-green-500",
                          round.won === false && "bg-red-500/20 text-red-500",
                          round.won === undefined && "bg-muted text-muted-foreground"
                        )}
                      >
                        {round.won === true && "W"}
                        {round.won === false && "L"}
                        {round.won === undefined && "?"}
                      </div>

                      {/* Side Indicator (Optional) - Compact */}
                      {round.side && (
                        <div
                          className={cn(
                            "text-[9px] font-medium px-1 rounded",
                            round.side === 'attack' && "text-red-400",
                            round.side === 'defense' && "text-blue-400"
                          )}
                        >
                          {round.side === 'attack' ? 'A' : 'D'}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    )
  }

  // Flat timeline view
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1 pb-1">
        {rounds.map((round) => {
          const isSelected = selectedRoundId === round.round_id
          const isClickable = !!onRoundSelect

          return (
            <motion.button
              key={round.round_id}
              onClick={() => isClickable && onRoundSelect(round.round_id)}
              disabled={!isClickable}
              className={cn(
                "relative flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all",
                "min-w-[44px]",
                isClickable && "hover:shadow cursor-pointer",
                !isClickable && "cursor-default",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-muted/30 hover:border-primary/40"
              )}
              whileHover={isClickable ? { scale: 1.02 } : {}}
              whileTap={isClickable ? { scale: 0.98 } : {}}
            >
              {/* Map Name - Compact */}
              <div className="text-[9px] font-medium text-muted-foreground truncate max-w-[40px]">
                {round.map_name.slice(0, 4)}
              </div>

              {/* Round Number */}
              <div className="text-[10px] font-medium text-muted-foreground">
                R{round.round_number}
              </div>

              {/* Win/Loss Indicator */}
              <div
                className={cn(
                  "w-7 h-7 rounded flex items-center justify-center font-bold text-xs",
                  round.won === true && "bg-green-500/20 text-green-500",
                  round.won === false && "bg-red-500/20 text-red-500",
                  round.won === undefined && "bg-muted text-muted-foreground"
                )}
              >
                {round.won === true && "W"}
                {round.won === false && "L"}
                {round.won === undefined && "?"}
              </div>

              {/* Side Indicator (Optional) */}
              {round.side && (
                <div
                  className={cn(
                    "text-[9px] font-medium px-1 rounded",
                    round.side === 'attack' && "text-red-400",
                    round.side === 'defense' && "text-blue-400"
                  )}
                >
                  {round.side === 'attack' ? 'A' : 'D'}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
