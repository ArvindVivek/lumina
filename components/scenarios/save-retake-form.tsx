'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScenarioResult, EmptyScenarioResult } from './scenario-result'
import { toast } from 'sonner'

export function SaveRetakeForm() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [form, setForm] = useState({
    defender_economy: 3000,
    attacker_economy: 5000,
    defenders_alive: 2,
    attackers_alive: 3,
    time_remaining: 30,
    spike_planted: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/scenarios/save-retake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defender_economy: form.defender_economy,
          defender_alive: form.defenders_alive,
          attacker_alive: form.attackers_alive,
          time_remaining_ms: form.time_remaining * 1000, // Convert to ms
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

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Save vs Retake</CardTitle>
          <CardDescription>
            Should defenders save weapons or attempt retake?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defender_economy">Defender Economy</Label>
                <Input
                  id="defender_economy"
                  type="number"
                  value={form.defender_economy}
                  onChange={(e) => setForm({ ...form, defender_economy: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attacker_economy">Attacker Economy</Label>
                <Input
                  id="attacker_economy"
                  type="number"
                  value={form.attacker_economy}
                  onChange={(e) => setForm({ ...form, attacker_economy: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defenders_alive">Defenders Alive</Label>
                <Input
                  id="defenders_alive"
                  type="number"
                  min="1"
                  max="5"
                  value={form.defenders_alive}
                  onChange={(e) => setForm({ ...form, defenders_alive: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attackers_alive">Attackers Alive</Label>
                <Input
                  id="attackers_alive"
                  type="number"
                  min="1"
                  max="5"
                  value={form.attackers_alive}
                  onChange={(e) => setForm({ ...form, attackers_alive: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_remaining">Time Remaining (s)</Label>
                <Input
                  id="time_remaining"
                  type="number"
                  min="0"
                  max="45"
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
          metrics={[
            { label: 'Retake Win Rate', value: `${((result.data?.retake_win_rate || 0) * 100).toFixed(1)}%`, highlight: true },
            { label: 'Save EV', value: result.data?.ev_analysis?.save?.expected_value?.toFixed(0) || 'N/A' },
            { label: 'Retake EV', value: result.data?.ev_analysis?.retake?.expected_value?.toFixed(0) || 'N/A' },
            { label: 'Matches Found', value: result.matches || 0 },
          ]}
          insight={result.recommendation?.decision ? `Decision: ${result.recommendation.decision.toUpperCase()}` : undefined}
        />
      ) : (
        <EmptyScenarioResult />
      )}
    </div>
  )
}
