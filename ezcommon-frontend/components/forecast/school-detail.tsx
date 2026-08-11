"use client"
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SavedCollege } from '@/lib/college-store'
import type { SchoolForecast } from '@/lib/forecast-store'

const CATEGORY_LABEL = { reach: 'Reach', target: 'Target', safety: 'Safety' } as const

const SIGNALS = [
  { key: 'materialStrength' as const, label: 'Material Strength' },
  { key: 'profileFit' as const, label: 'Profile Fit' },
  { key: 'narrativeFit' as const, label: 'Narrative Fit' },
]

export function SchoolDetail({ college, forecast }: { college: SavedCollege | null; forecast: SchoolForecast | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!college) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Click a school on the left to inspect.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-display text-2xl font-semibold text-primary">{college.name}</h3>
        {forecast && (
          <p className="text-2xl font-semibold text-primary shrink-0">
            {forecast.chance}
            <span className="text-sm align-top">%</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-5">
        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{CATEGORY_LABEL[college.category]}</span>
      </div>

      {!forecast ? (
        <p className="text-sm text-muted-foreground">
          No forecast yet for this school - click Refresh above to generate one.
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Signal breakdown</p>
            <div className="space-y-3">
              {SIGNALS.map((signal) => {
                const value = forecast[signal.key]
                return (
                  <div key={signal.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-primary">{signal.label}</span>
                      <span className="text-muted-foreground">Room to grow {100 - value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Analysis</p>
            <p className={cn('text-sm text-foreground', !expanded && 'line-clamp-3')}>{forecast.analysis}</p>
            {forecast.analysis.length > 160 && (
              <button onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-primary hover:underline mt-1">
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Recommendation</p>
            <p className="text-sm text-foreground">{forecast.recommendation}</p>
          </div>
        </>
      )}
    </div>
  )
}
