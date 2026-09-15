"use client"
import { useState } from 'react'
import { Info, X } from 'lucide-react'
import type { ForecastSnapshot, SchoolForecast } from '@/lib/forecast-store'
import type { SavedCollege } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import { ADMISSIONS_CORRELATION, independentChance, portfolioChance } from '@/lib/portfolio-chance'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

/** The portfolio number over time, drawn from real saved refreshes only. */
function TrendLine({ history, current }: { history: ForecastSnapshot[]; current: number }) {
  const t = useT()
  const points = history.length > 0 ? history.map((h) => h.portfolioChance) : [current]

  if (points.length < 2) {
    return (
      <div className="h-24 rounded-lg bg-muted/50 flex items-center justify-center relative">
        <div className="h-px w-[85%] bg-border absolute" />
        <div className="relative flex flex-col items-center">
          <span className="rounded-md bg-primary text-primary-foreground text-xs px-2 py-1 mb-1 whitespace-nowrap">
            {t('forecast.overall.nowLabel').replace('{percent}', String(Math.round(current)))}
          </span>
          <span className="h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
        </div>
      </div>
    )
  }

  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = Math.max(max - min, 1)
  const coords = points.map((p, i) => ({
    x: 6 + (i / (points.length - 1)) * 288,
    y: 76 - ((p - min) / span) * 56,
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  const first = points[0]
  const delta = current - first

  return (
    <div className="relative">
      <svg viewBox="0 0 300 96" className="w-full h-24" role="img" aria-label={t('forecast.overall.portfolioTrend')}>
        <path
          d={`${path} L${last.x.toFixed(1)} 92 L6 92 Z`}
          fill="hsl(var(--primary))"
          fillOpacity="0.07"
        />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.75" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2}
            fill={i === coords.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
        {t('forecast.overall.sinceFirst')
          .replace('{count}', String(points.length))
          .replace('{delta}', `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`)}
      </p>
    </div>
  )
}

export function OverallChance({
  colleges,
  schools,
  history,
}: {
  colleges: SavedCollege[]
  schools: SchoolForecast[]
  history: ForecastSnapshot[]
}) {
  const t = useT()
  const [formulaOpen, setFormulaOpen] = useState(false)

  const reach = colleges.filter((c) => c.category === 'reach').length
  const target = colleges.filter((c) => c.category === 'target').length
  const safety = colleges.filter((c) => c.category === 'safety').length

  const chances = schools.map((s) => s.chance)
  const aware = portfolioChance(chances)
  const legacy = independentChance(chances)
  const lowConfidence = colleges.length < 3

  return (
    <div className="rounded-2xl border bg-card p-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-8 items-start">
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t('forecast.overall.chanceOfOffer')}
          </p>
          <p className="font-display text-5xl font-semibold text-primary tabular-nums">
            {Math.round(aware)}
            <span className="text-2xl align-top">%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t('forecast.overall.basedOn').replace('{count}', String(schools.length))}
          </p>

          <button
            type="button"
            onClick={() => setFormulaOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Info className="h-3 w-3" />
            {t('forecast.overall.viewFormula')}
          </button>

          {formulaOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border bg-card p-4 shadow-lg animate-fade-in-up motion-reduce:animate-none">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('forecast.overall.formulaTitle')}
                </p>
                <button
                  type="button"
                  onClick={() => setFormulaOpen(false)}
                  aria-label={t('common.close')}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">{t('forecast.overall.formulaAware')}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    {t('forecast.overall.formulaAwareHint').replace('{rho}', String(ADMISSIONS_CORRELATION))}
                  </p>
                </div>
                <p className="font-display text-lg text-primary tabular-nums shrink-0">{aware.toFixed(1)}%</p>
              </div>

              <div className="flex items-baseline justify-between gap-3 mt-3 pt-3 border-t">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{t('forecast.overall.formulaLegacy')}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    {t('forecast.overall.formulaLegacyHint')}
                  </p>
                </div>
                <p className="font-display text-lg text-amber-700 tabular-nums shrink-0">{legacy.toFixed(1)}%</p>
              </div>

              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t leading-relaxed">
                {t('forecast.overall.formulaNote')}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="rounded-full border px-2 py-0.5 text-xs">
              {t(CATEGORY_LABEL_KEY.reach)} · {reach}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs">
              {t(CATEGORY_LABEL_KEY.target)} · {target}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs">
              {t(CATEGORY_LABEL_KEY.safety)} · {safety}
            </span>
            {lowConfidence && (
              <span className={cn('rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium')}>
                {t('forecast.overall.lowConfidence')}
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t('forecast.overall.portfolioTrend')}
          </p>
          <TrendLine history={history} current={aware} />
          {history.length < 2 && (
            <p className="text-xs text-muted-foreground mt-2">{t('forecast.overall.firstForecastHint')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
