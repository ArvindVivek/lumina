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
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a player..." />
      </SelectTrigger>
      <SelectContent>
        {players.map((player) => (
          <SelectItem key={player.id} value={player.id}>
            {player.name} ({player.team})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
