'use client'

import { useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'
import { useScreenData } from '@/lib/context/screen-data-context'

interface Team {
  id: string
  name: string
  shortName?: string
  region?: string
}

interface TeamSelectorProps {
  teams: Team[]
  selectedTeamId?: string
}

export function TeamSelector({ teams, selectedTeamId }: TeamSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setPageInfo, pushData } = useScreenData()

  // Update screen context when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      const selectedTeam = teams.find(t => t.id === selectedTeamId)
      setPageInfo({
        page: 'macro-review',
        pageTitle: selectedTeam ? `${selectedTeam.name} Macro Review` : 'Macro Review',
        teamId: selectedTeamId,
      })

      // Push team info to visible data for chat context
      if (selectedTeam) {
        pushData('selected_team', {
          id: selectedTeam.id,
          name: selectedTeam.name,
          shortName: selectedTeam.shortName,
          region: selectedTeam.region,
        })
      }
    }
  }, [selectedTeamId, teams, setPageInfo, pushData])

  const handleSelect = (teamId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('team', teamId)
    router.push(`/macro-review?${params.toString()}`)
  }

  return (
    <Select value={selectedTeamId} onValueChange={handleSelect}>
      <SelectTrigger className="w-[280px] bg-muted/50 border-border/80 hover:border-primary/50 hover:bg-muted transition-all">
        <SelectValue placeholder="Select a team..." />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id} className="cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="font-medium">{team.name}</span>
              {team.region && (
                <span className="text-xs text-muted-foreground">({team.region})</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
