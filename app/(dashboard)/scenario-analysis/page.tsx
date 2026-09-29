import type { Metadata } from "next"
import { PageHeader } from "@/components/lumina/page-header"
import { ScenarioLab } from "@/components/scenario-lab"
import { getDb } from "@/lib/data"

export const metadata: Metadata = {
  title: "Scenario lab",
  description: "Save or retake, force or save, clutch odds: see how pros fared in the same spot.",
}

export default function ScenarioAnalysisPage() {
  const maps = [...new Set(getDb().games.map((g) => g.map_name))].sort()
  return (
    <div className="space-y-8">
      <PageHeader title="Scenario lab" description="Describe a moment in a round and see how the same spot went in pro matches." />
      <ScenarioLab maps={maps} />
    </div>
  )
}
