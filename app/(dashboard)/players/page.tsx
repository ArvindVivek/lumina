import type { Metadata } from "next"
import { PageHeader } from "@/components/lumina/page-header"
import { PlayerTable } from "@/components/lumina/player-table"
import { getDb } from "@/lib/data"
import { listPlayers } from "@/lib/data/queries"

export const metadata: Metadata = {
  title: "Players",
  description: "Every player in the sample with kills, deaths, opening duels and clutches.",
}

export default function PlayersPage() {
  const players = listPlayers(getDb())
  return (
    <div className="space-y-8">
      <PageHeader title="Players" description={`${players.length} players across the sample. Open one for their full breakdown.`} />
      <PlayerTable players={players} />
    </div>
  )
}
