import type { SchoolForecast } from '@/lib/forecast-store'
import type { SavedCollege } from '@/lib/college-store'

export function OverallChance({ colleges, schools }: { colleges: SavedCollege[]; schools: SchoolForecast[] }) {
  const reach = colleges.filter((c) => c.category === 'reach').length
  const target = colleges.filter((c) => c.category === 'target').length
  const safety = colleges.filter((c) => c.category === 'safety').length

  // P(at least one offer) assuming independence across schools.
  const atLeastOne =
    schools.length > 0
      ? Math.round((1 - schools.reduce((acc, s) => acc * (1 - s.chance / 100), 1)) * 100)
      : 0

  const lowConfidence = colleges.length < 3

  return (
    <div className="rounded-2xl border bg-card p-6 mb-6">
      <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Chance of at least one offer
          </p>
          <p className="font-display text-5xl font-semibold text-primary">
            {atLeastOne}
            <span className="text-2xl align-top">%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">Based on {schools.length} saved school{schools.length !== 1 ? 's' : ''}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="rounded-full border px-2 py-0.5 text-xs">Reach · {reach}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">Target · {target}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">Safety · {safety}</span>
            {lowConfidence && (
              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                Low forecast confidence
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Portfolio trend · recent history
          </p>
          <div className="h-24 rounded-lg bg-muted/50 flex items-center justify-center relative">
            <div className="h-px w-[85%] bg-border absolute" />
            <div className="relative flex flex-col items-center">
              <span className="rounded-md bg-primary text-primary-foreground text-xs px-2 py-1 mb-1 whitespace-nowrap">
                {atLeastOne}% · Now
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This is your first forecast - trend history will build up as you generate more over time.
          </p>
        </div>
      </div>
    </div>
  )
}
