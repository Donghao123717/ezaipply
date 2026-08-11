"use client"
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SavedCollege } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import type { SchoolForecast } from '@/lib/forecast-store'
import { useT } from '@/lib/i18n/use-t'

export function SchoolDetail({ college, forecast }: { college: SavedCollege | null; forecast: SchoolForecast | null }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)

  const SIGNALS = [
    { key: 'materialStrength' as const, label: t('forecast.detail.materialStrength') },
    { key: 'profileFit' as const, label: t('forecast.detail.profileFit') },
    { key: 'narrativeFit' as const, label: t('forecast.detail.narrativeFit') },
  ]

  if (!college) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('forecast.detail.clickToInspect')}
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
        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{t(CATEGORY_LABEL_KEY[college.category])}</span>
      </div>

      {!forecast ? (
        <p className="text-sm text-muted-foreground">{t('forecast.detail.noForecast')}</p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t('forecast.detail.signalBreakdown')}</p>
            <div className="space-y-3">
              {SIGNALS.map((signal) => {
                const value = forecast[signal.key]
                return (
                  <div key={signal.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-primary">{signal.label}</span>
                      <span className="text-muted-foreground">{t('forecast.detail.roomToGrow').replace('{percent}', String(100 - value))}</span>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('forecast.detail.analysis')}</p>
            <p className={cn('text-sm text-foreground', !expanded && 'line-clamp-3')}>{forecast.analysis}</p>
            {forecast.analysis.length > 160 && (
              <button onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-primary hover:underline mt-1">
                {expanded ? t('forecast.detail.showLess') : t('forecast.detail.showMore')}
              </button>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t('forecast.detail.recommendation')}</p>
            <p className="text-sm text-foreground">{forecast.recommendation}</p>
          </div>
        </>
      )}
    </div>
  )
}
