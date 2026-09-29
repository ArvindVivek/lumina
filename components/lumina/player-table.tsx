"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Card, Chip, EmptyState, Icon } from "@/components/kl"
import { agentLabel } from "@/lib/data/names"
import type { PlayerRow } from "@/lib/data/queries"
import { TeamBadge } from "./team-badge"

const SORTS = {
  name: { label: "Name", by: (a: PlayerRow, b: PlayerRow) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) },
  kd: { label: "K/D", by: (a: PlayerRow, b: PlayerRow) => b.kd - a.kd },
  first: { label: "First kills", by: (a: PlayerRow, b: PlayerRow) => b.first_kills - a.first_kills },
  clutch: { label: "Clutches", by: (a: PlayerRow, b: PlayerRow) => b.clutches_won - a.clutches_won },
} as const

/** Searchable, sortable player list. Rows link to the player's insights. */
export function PlayerTable({ players }: { players: PlayerRow[] }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<keyof typeof SORTS>("name")
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return players
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.team_name ?? "").toLowerCase().includes(q))
      .sort(SORTS[sort].by)
  }, [players, query, sort])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1 sm:max-w-sm">
          <span className="sr-only">Search players or teams</span>
          <Icon icon={Search} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players or teams"
            className="h-12 w-full rounded-sm bg-surface pl-11 pr-4 text-base text-ink shadow-[var(--shadow-card)] placeholder:text-ink-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort by">
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <Chip key={k} selected={sort === k} onClick={() => setSort(k)}>
              {SORTS[k].label}
            </Chip>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="No players match" message="Try part of a name, or a team like Sentinels." tone="neutral" />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-extrabold">Player</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold">Rounds</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold" title="Kills per death">K/D</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold">First kills</th>
                  <th scope="col" className="px-2 py-3 text-right font-extrabold">Clutches</th>
                  <th scope="col" className="px-4 py-3 font-extrabold">Main agents</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-t border-line hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/player-analytics?player=${p.id}`} className="flex min-h-11 items-center gap-3">
                        {p.team_name && <TeamBadge name={p.team_name} size="sm" />}
                        <span>
                          <span className="block font-bold text-ink">{p.name}</span>
                          <span className="block text-[13px] text-ink-2">{p.team_name ?? "No team"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{p.rounds}</td>
                    <td className="tabular px-2 py-2.5 text-right font-bold text-ink">{p.kd.toFixed(2)}</td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{p.first_kills}</td>
                    <td className="tabular px-2 py-2.5 text-right text-ink">{p.clutches_won}</td>
                    <td className="px-4 py-2.5 text-ink-2">{p.top_agents.map(agentLabel).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
