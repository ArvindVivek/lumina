'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'

interface Player {
  id: string
  name: string
  team: string
}

interface PlayerSelectorProps {
  players: Player[]
  selectedPlayerId?: string
}

export function PlayerSelector({ players, selectedPlayerId }: PlayerSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSelect = (playerId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('player', playerId)
    router.push(`/player-analytics?${params.toString()}`)
  }

  return (
    <Select value={selectedPlayerId} onValueChange={handleSelect}>
      <SelectTrigger className="w-[280px] bg-muted/50 border-border/80 hover:border-primary/50 hover:bg-muted transition-all">
        <SelectValue placeholder="Select a player..." />
      </SelectTrigger>
      <SelectContent>
        {players.map((player) => (
          <SelectItem key={player.id} value={player.id} className="cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="font-medium">{player.name}</span>
              <span className="text-xs text-muted-foreground">({player.team})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
