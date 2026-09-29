import Link from "next/link"
import { Card } from "@/components/kl"
import { cn } from "@/lib/kl/cn"
import { agentLabel } from "@/lib/data/names"
import type { ScoreboardLine } from "@/lib/data/queries"
import { TeamBadge } from "./team-badge"

/**
 * Per-player lines for a map or a series, one table per team. On phones the table scrolls
 * sideways inside its card; the player column stays readable.
 */
export function Scoreboard({ lines, teams }: { lines: ScoreboardLine[]; teams: { id: string; name: string; won: boolean }[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {teams.map((team) => {
        const rows = lines.filter((l) => l.team_id === team.id)
        return (
          <Card key={team.id} padding="none" className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <TeamBadge name={team.name} size="sm" tone={team.won ? "win" : "neutral"} />
              <h3 className="text-title3 text-ink">{team.name}</h3>
              {team.won && <span className="ml-auto text-sm font-bold text-success-text">Won</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[15px]">
                <thead>
                  <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                    <th scope="col" className="px-4 py-2 font-extrabold">Player</th>
                    <th scope="col" className="px-2 py-2 text-right font-extrabold" title="Kills / deaths / assists">K / D / A</th>
                    <th scope="col" className="px-2 py-2 text-right font-extrabold" title="Kills per round">KPR</th>
                    <th scope="col" className="px-2 py-2 text-right font-extrabold" title="Opening duels won and lost">First K–D</th>
                    <th scope="col" className="px-4 py-2 text-right font-extrabold">Clutches</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.player_id} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <Link href={`/player-analytics?player=${l.player_id}`} className="font-bold text-ink hover:text-accent-text">
                          {l.name}
                        </Link>
                        <span className="block text-[13px] text-ink-2">{l.agents.map(agentLabel).join(", ")}</span>
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-ink">
                        {l.kills} / {l.deaths} / {l.assists}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-ink">{l.kpr.toFixed(2)}</td>
                      <td className={cn("tabular px-2 py-2.5 text-right", l.first_kills >= l.first_deaths ? "text-success-text" : "text-danger-text")}>
                        {l.first_kills}–{l.first_deaths}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-ink">{l.clutches_won}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
