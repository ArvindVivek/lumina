import Link from "next/link"
import { ArrowRight, Crosshair, FlaskConical, Map as MapIcon, Sparkles, Swords, Target, Trophy, type LucideIcon } from "lucide-react"
import { Card, Icon, SectionHeader, StatTile } from "@/components/kl"
import { PageHeader } from "@/components/lumina/page-header"
import { SeriesCard } from "@/components/lumina/series-card"
import { TeamBadge } from "@/components/lumina/team-badge"
import { getDb } from "@/lib/data"
import { datasetStats, listPlayers, listSeries } from "@/lib/data/queries"
import { agentLabel } from "@/lib/data/names"

const TOOLS: { href: string; title: string; text: string; icon: LucideIcon }[] = [
  { href: "/analytics", title: "Match report", text: "Pick a series and a team: opening duels, trades, post-plants and the rounds worth rewatching.", icon: Sparkles },
  { href: "/player-analytics", title: "Player insights", text: "One player's first kills, trades, clutches, agents and how they play on each buy.", icon: Crosshair },
  { href: "/macro-review", title: "Team review", text: "A team's pistol rounds, economy, trading discipline and the moments that swung games.", icon: Target },
  { href: "/scenario-analysis", title: "Scenario lab", text: "Save or retake? Force or eco? See how pros fared in the same spot.", icon: FlaskConical },
]

/** Players need this many rounds to rank, so a one-map substitute can't top the table. */
const MIN_ROUNDS = 150

export default function HomePage() {
  const db = getDb()
  const stats = datasetStats(db)
  const latest = listSeries(db, { limit: 4 })
  const leaders = listPlayers(db)
    .filter((p) => p.rounds >= MIN_ROUNDS)
    .sort((a, b) => b.kd - a.kd)
    .slice(0, 6)

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="VALORANT match analytics"
        title="Every round, explained"
        description="Lumina turns pro match logs into scouting notes: who wins the opening duels, how teams spend, which rounds to rewatch, and an AI coach that answers from the numbers."
      />

      <section aria-labelledby="inside" className="space-y-4">
        <SectionHeader id="inside" title="What's inside" description="VCT Americas playoffs from 2024 and 2025, rebuilt round by round from the official match feed." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Trophy} value={stats.series} label="Series" detail={`${stats.tournaments} playoff brackets`} />
          <StatTile icon={MapIcon} value={stats.games} label="Maps" detail={`${stats.teams} teams`} />
          <StatTile icon={Swords} value={stats.rounds.toLocaleString("en-US")} label="Rounds" detail={`${stats.players} players`} />
          <StatTile icon={Crosshair} value={stats.killEvents.toLocaleString("en-US")} label="Kills" detail={`${stats.clutchSituations.toLocaleString("en-US")} clutch rounds`} />
        </div>
      </section>

      <section aria-labelledby="tools" className="space-y-4">
        <SectionHeader id="tools" title="Start here" />
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="group flex gap-4 rounded-lg bg-surface p-5 shadow-[var(--shadow-card)] transition-colors duration-75 hover:bg-surface-2">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-text">
                <Icon icon={t.icon} size={24} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-display text-title3 text-ink">
                  {t.title}
                  <Icon icon={ArrowRight} size={18} className="text-ink-2 transition-transform duration-75 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-[15px] text-ink-2">{t.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="latest" className="space-y-4">
          <SectionHeader
            id="latest"
            title="Latest results"
            action={
              <Link href="/tournaments" className="inline-flex min-h-11 items-center px-2 text-[15px] font-bold text-accent-text">
                All tournaments
              </Link>
            }
          />
          <div className="space-y-3">
            {latest.map((s) => (
              <SeriesCard key={s.id} s={s} />
            ))}
          </div>
        </section>

        <section aria-labelledby="leaders" className="space-y-4">
          <SectionHeader id="leaders" title="Top fraggers" description={`Kills per death, ${MIN_ROUNDS}+ rounds played`} />
          <Card padding="none" className="overflow-hidden">
            <ol>
              {leaders.map((p, i) => (
                <li key={p.id} className="border-b border-line last:border-b-0">
                  <Link href={`/player-analytics?player=${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="tabular w-5 text-right font-display text-title3 text-ink-2">{i + 1}</span>
                    {p.team_name && <TeamBadge name={p.team_name} size="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{p.name}</span>
                      <span className="block truncate text-[13px] text-ink-2">{p.top_agents.map(agentLabel).join(", ")}</span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block font-display text-title3 text-ink">{p.kd.toFixed(2)}</span>
                      <span className="block text-[13px] text-ink-2">{p.rounds} rounds</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>
    </div>
  )
}
