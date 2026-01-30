'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'

interface Team {
  id: string
  name: string
}

interface TeamSelectorProps {
  teams: Team[]
  selectedTeamId?: string
}

export function TeamSelector({ teams, selectedTeamId }: TeamSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSelect = (teamId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('team', teamId)
    router.push(`/macro-review?${params.toString()}`)
  }

  return (
    <Select value={selectedTeamId} onValueChange={handleSelect}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a team..." />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
