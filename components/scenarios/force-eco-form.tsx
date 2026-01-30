'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScenarioResult, EmptyScenarioResult } from './scenario-result'
import { toast } from 'sonner'

export function ForceEcoForm() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [form, setForm] = useState({
    team_economy: 8000,
    opponent_economy: 20000,
    round_number: 5,
    score_differential: -2,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/scenarios/force-eco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_economy: form.team_economy,
          opponent_economy: form.opponent_economy,
          round_number: form.round_number,
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
          <CardTitle>Force vs Eco</CardTitle>
          <CardDescription>
            Should the team force buy or full eco this round?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="team_economy">Team Economy</Label>
                <Input
                  id="team_economy"
                  type="number"
                  value={form.team_economy}
                  onChange={(e) => setForm({ ...form, team_economy: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opponent_economy">Opponent Economy</Label>
                <Input
                  id="opponent_economy"
                  type="number"
                  value={form.opponent_economy}
                  onChange={(e) => setForm({ ...form, opponent_economy: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round_number">Round Number</Label>
                <Input
                  id="round_number"
                  type="number"
                  min="1"
                  max="30"
                  value={form.round_number}
                  onChange={(e) => setForm({ ...form, round_number: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score_differential">Score Diff (+/-)</Label>
                <Input
                  id="score_differential"
                  type="number"
                  min="-12"
                  max="12"
                  value={form.score_differential}
                  onChange={(e) => setForm({ ...form, score_differential: parseInt(e.target.value) || 0 })}
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
            { label: 'Eco Win Rate', value: `${((result.data?.eco_win_rate || 0) * 100).toFixed(1)}%` },
            { label: 'Force Win Rate', value: `${((result.data?.force_win_rate || 0) * 100).toFixed(1)}%`, highlight: true },
            { label: 'Full Buy Win Rate', value: `${((result.data?.full_buy_win_rate || 0) * 100).toFixed(1)}%` },
            { label: 'Total Rounds', value: result.data?.rounds_analyzed || 0 },
          ]}
          insight={result.recommendation?.decision ? `Decision: ${result.recommendation.decision.toUpperCase().replace('_', ' ')}` : undefined}
        />
      ) : (
        <EmptyScenarioResult />
      )}
    </div>
  )
}
