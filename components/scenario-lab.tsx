"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { FlaskConical } from "lucide-react"
import { Button, Card, Chip, EmptyState, Field, Input, Select } from "@/components/kl"
import { ConfidenceBadge } from "@/components/lumina/insight-card"
import { credits, pct } from "@/components/lumina/format"
import { mapLabel } from "@/lib/data/names"
import type { ConfidenceScore } from "@/lib/analytics/types"

type Tab = "retake" | "buy" | "clutch"

const TABS: { key: Tab; label: string; question: string }[] = [
  { key: "retake", label: "Save or retake", question: "The spike is down. Should the defenders retake or save their guns?" },
  { key: "buy", label: "Force or save", question: "Low on credits. Is a force buy worth it against this loadout?" },
  { key: "clutch", label: "Clutch odds", question: "One player left against several. How often do pros win it?" },
]

const COUNTS = [1, 2, 3, 4, 5]

interface Result {
  matches: number
  confidence: ConfidenceScore
  recommendation: { decision: string; rationale: string } | null
  data: Record<string, unknown>
}

function Answer({ result, headline, facts }: { result: Result; headline: ReactNode; facts: [string, string][] }) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-title3 text-ink">What pros did</h3>
        <ConfidenceBadge confidence={result.confidence} />
      </div>
      <p className="text-[17px] text-ink">{headline}</p>
      <dl className="grid grid-cols-2 gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse rounded-sm bg-surface-2 px-3 py-2">
            <dt className="text-[13px] text-ink-2">{label}</dt>
            <dd className="tabular font-display text-title2 text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {result.recommendation ? (
        <p className="rounded-sm bg-accent-soft px-4 py-3 text-[15px] text-ink">
          <span className="font-bold">Call: </span>
          {result.recommendation.rationale}.
        </p>
      ) : (
        <p className="text-[15px] text-ink-2">Too few similar rounds to make a call. Try a nearby situation.</p>
      )}
    </Card>
  )
}

function CountSelect({ label, value, onChange, from = 1 }: { label: string; value: number; onChange: (n: number) => void; from?: number }) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {COUNTS.filter((n) => n >= from).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/**
 * Ask a what-if about a round and see how often pros in the sample won from the same spot.
 * Pure numbers from /api/scenarios/*; no AI.
 */
export function ScenarioLab({ maps }: { maps: string[] }) {
  const [tab, setTab] = useState<Tab>("retake")
  const [map, setMap] = useState("")
  const [retake, setRetake] = useState({ defenders: 3, attackers: 3, loadout: 15000 })
  const [buy, setBuy] = useState({ team: 12000, opponent: 20000 })
  const [clutch, setClutch] = useState({ opponents: 2 })
  const [result, setResult] = useState<{ tab: Tab; data: Result } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const map_name = map || undefined
    const request =
      tab === "retake"
        ? { url: "/api/scenarios/save-retake", body: { defender_economy: retake.loadout, defender_alive: retake.defenders, attacker_alive: retake.attackers, map_name } }
        : tab === "buy"
          ? { url: "/api/scenarios/force-eco", body: { team_economy: buy.team, opponent_economy: buy.opponent, map_name } }
          : { url: "/api/scenarios/clutch", body: { clutch_player_count: 1, opponent_count: clutch.opponents, map_name } }
    try {
      const res = await fetch(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.body) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      setResult({ tab, data: await res.json() })
    } catch (err) {
      console.error("[scenario] failed", err)
      setError("We couldn't check that situation. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const current = TABS.find((t) => t.key === tab)!
  const shown = result?.tab === tab ? result.data : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Scenario">
        {TABS.map((t) => (
          <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="form" onSubmit={submit} className="space-y-4">
          <p className="text-[17px] font-bold text-ink">{current.question}</p>

          {tab === "retake" && (
            <div className="grid grid-cols-2 gap-4">
              <CountSelect label="Defenders alive" value={retake.defenders} onChange={(n) => setRetake({ ...retake, defenders: n })} />
              <CountSelect label="Attackers alive" value={retake.attackers} onChange={(n) => setRetake({ ...retake, attackers: n })} />
              <Field label="Defenders' loadout" hint={`Team total, in credits (${credits(retake.loadout)})`} className="col-span-2">
                <Input type="number" inputMode="numeric" min={0} max={50000} step={500} value={retake.loadout} onChange={(e) => setRetake({ ...retake, loadout: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          )}

          {tab === "buy" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your team's spend" hint={credits(buy.team)}>
                <Input type="number" inputMode="numeric" min={0} max={50000} step={500} value={buy.team} onChange={(e) => setBuy({ ...buy, team: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Their spend" hint={credits(buy.opponent)}>
                <Input type="number" inputMode="numeric" min={0} max={50000} step={500} value={buy.opponent} onChange={(e) => setBuy({ ...buy, opponent: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          )}

          {tab === "clutch" && <CountSelect label="Enemies left" value={clutch.opponents} onChange={(n) => setClutch({ opponents: n })} />}

          <Field label="Map">
            <Select value={map} onChange={(e) => setMap(e.target.value)}>
              <option value="">Any map</option>
              {maps.map((m) => (
                <option key={m} value={m}>
                  {mapLabel(m)}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" fullWidth loading={busy}>
            Check the history
          </Button>
          {error && <p className="text-[15px] font-bold text-danger-text">{error}</p>}
        </Card>

        {shown ? (
          tab === "retake" ? (
            <Answer
              result={shown}
              headline={
                <>
                  In {shown.matches} similar post-plant rounds, the defenders won{" "}
                  <span className="font-bold">{pct((shown.data.retake_win_rate as number) ?? 0)}</span> of retakes.
                </>
              }
              facts={[
                ["Retakes won", pct((shown.data.retake_win_rate as number) ?? 0)],
                ["Similar rounds", String(shown.matches)],
                ["Guns you'd keep", credits((shown.data.avg_weapon_value as number) ?? 0)],
                ["Better choice", (shown.data.ev_analysis as { recommended_decision: string })?.recommended_decision === "retake" ? "Retake" : "Save"],
              ]}
            />
          ) : tab === "buy" ? (
            <Answer
              result={shown}
              headline={
                <>
                  Teams on a <span className="font-bold">{String(shown.data.economy_category).replace("_", " ")}</span> against a similar loadout won{" "}
                  <span className="font-bold">
                    {pct(
                      (shown.data.economy_category === "eco" ? shown.data.eco_win_rate : shown.data.economy_category === "force_buy" ? shown.data.force_win_rate : shown.data.full_buy_win_rate) as number,
                    )}
                  </span>{" "}
                  of {shown.matches} rounds.
                </>
              }
              facts={[
                ["Your buy", String(shown.data.economy_category).replace("_", " ")],
                ["Their buy", String(shown.data.opponent_category).replace("_", " ")],
                ["Similar rounds", String(shown.matches)],
                ["Win pays", "3,000 each"],
              ]}
            />
          ) : (
            <Answer
              result={shown}
              headline={
                <>
                  Pros won <span className="font-bold">{pct((shown.data.clutch_win_rate as number) ?? 0)}</span> of {shown.matches} one-versus-{clutch.opponents} clutches.
                </>
              }
              facts={[
                ["Clutches won", `${shown.data.clutches_won as number} of ${shown.matches}`],
                ["Situation", `1 v ${clutch.opponents}`],
                ...(((shown.data.top_agents as { agent: string; win_rate: number }[]) ?? []).slice(0, 2).map((a) => [`Best agent: ${a.agent}`, pct(a.win_rate)]) as [string, string][]),
              ]}
            />
          )
        ) : (
          <Card>
            <EmptyState icon={FlaskConical} title="Set up a situation" message="Pick the numbers on the left, then check how the same spot went in pro matches." tone="neutral" />
          </Card>
        )}
      </div>
      <p className="text-[13px] text-ink-2">
        Matched against every round in the sample. A call only appears with at least 10 similar rounds. Credits: a won round pays each player 3,000; a lost one pays at least 1,900.
      </p>
    </div>
  )
}
