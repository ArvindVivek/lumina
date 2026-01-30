import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SaveRetakeForm } from '@/components/scenarios/save-retake-form'
import { ForceEcoForm } from '@/components/scenarios/force-eco-form'
import { ClutchForm } from '@/components/scenarios/clutch-form'

export default function ScenarioAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scenario Analysis</h1>
        <p className="text-muted-foreground">
          Hypothetical scenario queries with expected value calculations
        </p>
      </div>

      <Tabs defaultValue="save-retake" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="save-retake">Save/Retake</TabsTrigger>
          <TabsTrigger value="force-eco">Force/Eco</TabsTrigger>
          <TabsTrigger value="clutch">Clutch</TabsTrigger>
        </TabsList>

        <TabsContent value="save-retake">
          <SaveRetakeForm />
        </TabsContent>

        <TabsContent value="force-eco">
          <ForceEcoForm />
        </TabsContent>

        <TabsContent value="clutch">
          <ClutchForm />
        </TabsContent>
      </Tabs>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
          How It Works
        </h2>
        <p className="text-sm text-muted-foreground">
          Scenarios are matched against historical VCT Americas data using weighted k-NN similarity.
          Recommendations are based on expected value calculations and are suppressed when confidence is low (n&lt;10).
        </p>
      </div>
    </div>
  )
}
