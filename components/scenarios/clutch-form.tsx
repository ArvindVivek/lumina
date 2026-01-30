'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScenarioResult, EmptyScenarioResult } from './scenario-result'
import { toast } from 'sonner'

const AGENTS = [
  'Jett', 'Raze', 'Phoenix', 'Reyna', 'Yoru', 'Neon', 'Iso',
  'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko',
  'Brimstone', 'Omen', 'Viper', 'Astra', 'Harbor', 'Clove',
  'Killjoy', 'Cypher', 'Sage', 'Chamber', 'Deadlock', 'Vyse',
]

export function ClutchForm() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [form, setForm] = useState({
    player_agent: 'Jett',
    opponents_remaining: 2,
    player_economy: 4000,
    spike_planted: true,
    time_remaining: 25,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/scenarios/clutch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clutch_player_count: 1,
          opponent_count: form.opponents_remaining,
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch scenario')
      const data = await res.json()
      setResult(data)
    } catch (error) {
      toast.error('Failed to analyze scenario', {
        description: 'Please try again or check your parameters.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Build metrics with top agents if available
  const buildMetrics = () => {
    if (!result) return []

    const metrics = [
      { label: 'Clutch Win Rate', value: `${((result.data?.clutch_win_rate || 0) * 100).toFixed(1)}%`, highlight: true },
      { label: 'Total Clutches', value: result.data?.clutch_situations || 0 },
      { label: 'Situation', value: result.data?.situation_label || `1v${form.opponents_remaining}` },
    ]

    // Add top agent if available
    if (result.data?.top_agents && result.data.top_agents.length > 0) {
      const topAgent = result.data.top_agents[0]
      metrics.push({
        label: 'Best Agent',
        value: `${topAgent.agent} (${(topAgent.win_rate * 100).toFixed(0)}%)`,
      })
    }

    return metrics
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Clutch Analysis</CardTitle>
          <CardDescription>
            What are the odds of winning this clutch situation?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="player_agent">Agent</Label>
                <Select
                  value={form.player_agent}
                  onValueChange={(value) => setForm({ ...form, player_agent: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opponents_remaining">Opponents</Label>
                <Input
                  id="opponents_remaining"
                  type="number"
                  min="1"
                  max="5"
                  value={form.opponents_remaining}
                  onChange={(e) => setForm({ ...form, opponents_remaining: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player_economy">Player Economy</Label>
                <Input
                  id="player_economy"
                  type="number"
                  value={form.player_economy}
                  onChange={(e) => setForm({ ...form, player_economy: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_remaining">Time (s)</Label>
                <Input
                  id="time_remaining"
                  type="number"
                  min="0"
                  max="100"
                  value={form.time_remaining}
                  onChange={(e) => setForm({ ...form, time_remaining: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze Scenario'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <ScenarioResult
          title="Analysis Result"
          recommendation={result.recommendation?.rationale || null}
          confidence={result.confidence}
          metrics={buildMetrics()}
          insight={result.recommendation?.decision ? `Decision: ${result.recommendation.decision.toUpperCase()}` : undefined}
        />
      ) : (
        <EmptyScenarioResult />
      )}
    </div>
  )
}
