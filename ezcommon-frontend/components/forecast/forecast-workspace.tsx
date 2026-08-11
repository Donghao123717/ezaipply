"use client"
import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadColleges, type SavedCollege } from '@/lib/college-store'
import { loadEssays } from '@/lib/essay-store'
import { loadProfileContext } from '@/lib/essay-store'
import { computeProfileStrength } from '@/lib/profile-strength'
import { loadForecast, saveForecast, computeSignature, timeAgo, type ForecastRecord, type SchoolForecast } from '@/lib/forecast-store'
import { OverallChance } from '@/components/forecast/overall-chance'
import { BySchoolList } from '@/components/forecast/by-school-list'
import { SchoolDetail } from '@/components/forecast/school-detail'

export function ForecastWorkspace({ userId }: { userId: string }) {
  const [colleges, setColleges] = useState<SavedCollege[]>([])
  const [forecast, setForecast] = useState<ForecastRecord | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const loadedColleges = loadColleges(userId)
    setColleges(loadedColleges)
    setSelectedId(loadedColleges[0]?.id ?? null)
    setForecast(loadForecast(userId))
    setReady(true)
  }, [userId])

  const stale = ready && forecast ? forecast.inputSignature !== computeSignature(userId) : false

  const forecastMap = useMemo(() => {
    const map = new Map<string, SchoolForecast>()
    forecast?.schools.forEach((s) => map.set(s.id, s))
    return map
  }, [forecast])

  async function generate() {
    if (colleges.length === 0) return
    setGenerating(true)
    setError(null)
    try {
      const essays = loadEssays(userId)
      const essaySummary = Object.entries(essays)
        .filter(([, r]) => r.html)
        .map(([taskId]) => `Has a draft in progress: ${taskId}`)
        .join('\n')

      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/forecast/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_context: loadProfileContext(userId),
          essay_summary: essaySummary,
          profile_strength: computeProfileStrength(userId),
          schools: colleges.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            baseline_acceptance_rate: c.acceptanceRate ?? 30,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Forecast generation failed')

      const record: ForecastRecord = {
        generatedAt: new Date().toISOString(),
        inputSignature: computeSignature(userId),
        schools: (data.schools || []).map((s: any) => ({
          id: s.id,
          chance: s.chance,
          materialStrength: s.material_strength,
          profileFit: s.profile_fit,
          narrativeFit: s.narrative_fit,
          analysis: s.analysis,
          recommendation: s.recommendation,
        })),
      }
      saveForecast(userId, record)
      setForecast(record)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const selectedCollege = colleges.find((c) => c.id === selectedId) || null
  const selectedForecast = selectedId ? forecastMap.get(selectedId) || null : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Your admission probabilities trend</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Probabilities are modeled from your profile signals and refresh whenever you update your profile or list.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {forecast && <span className="text-xs text-muted-foreground">Updated {timeAgo(forecast.generatedAt)}</span>}
          <Button variant="outline" size="sm" onClick={generate} disabled={generating || colleges.length === 0}>
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {colleges.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Save schools on the Colleges page first, then come back here to forecast your chances.
        </div>
      ) : !forecast ? (
        <div className="rounded-2xl border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No forecast yet for your current list.</p>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate forecast'
            )}
          </Button>
        </div>
      ) : (
        <>
          {stale && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 mb-6 flex-wrap">
              <p className="text-sm text-amber-800">
                Your profile, school list, or essay signals changed since this forecast was generated. Click Refresh to
                regenerate.
              </p>
              <Button size="sm" onClick={generate} disabled={generating}>
                Refresh now
              </Button>
            </div>
          )}

          <OverallChance colleges={colleges} schools={forecast.schools} />

          <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
            <BySchoolList colleges={colleges} forecasts={forecastMap} selectedId={selectedId} onSelect={setSelectedId} />
            <SchoolDetail college={selectedCollege} forecast={selectedForecast} />
          </div>
        </>
      )}
    </div>
  )
}
