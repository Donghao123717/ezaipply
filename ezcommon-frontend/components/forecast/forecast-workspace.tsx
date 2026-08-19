"use client"
import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadColleges, type SavedCollege } from '@/lib/college-store'
import { loadEssays } from '@/lib/essay-store'
import { loadProfileContext } from '@/lib/essay-store'
import { computeProfileStrength } from '@/lib/profile-strength'
import { computeStudentScores } from '@/lib/student-scores'
import { SCHOOL_ADMISSIONS_DATA } from '@/lib/school-admissions-data'
import { loadForecast, saveForecast, computeSignature, timeAgo, type ForecastRecord, type SchoolForecast } from '@/lib/forecast-store'
import { OverallChance } from '@/components/forecast/overall-chance'
import { BySchoolList } from '@/components/forecast/by-school-list'
import { SchoolDetail } from '@/components/forecast/school-detail'
import { useT } from '@/lib/i18n/use-t'

export function ForecastWorkspace({ userId }: { userId: string }) {
  const t = useT()
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

      const studentScores = computeStudentScores(userId)
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/forecast/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_context: loadProfileContext(userId),
          essay_summary: essaySummary,
          profile_strength: computeProfileStrength(userId),
          student_sat: studentScores.sat ?? null,
          student_act: studentScores.act ?? null,
          student_gpa: studentScores.gpa4 ?? null,
          schools: colleges.map((c) => {
            const admissions = SCHOOL_ADMISSIONS_DATA[c.name]
            return {
              id: c.id,
              name: c.name,
              category: c.category,
              baseline_acceptance_rate: admissions?.acceptanceRate ?? c.acceptanceRate ?? 30,
              sat_low: admissions?.satRange?.[0] ?? null,
              sat_high: admissions?.satRange?.[1] ?? null,
              act_low: admissions?.actRange?.[0] ?? null,
              act_high: admissions?.actRange?.[1] ?? null,
              gpa_low: admissions?.gpaRange?.[0] ?? null,
              gpa_high: admissions?.gpaRange?.[1] ?? null,
            }
          }),
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
          <h1 className="font-display text-3xl font-semibold text-primary">{t('forecast.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('forecast.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {forecast && <span className="text-xs text-muted-foreground">{t('forecast.updated').replace('{time}', timeAgo(forecast.generatedAt))}</span>}
          <Button variant="outline" size="sm" onClick={generate} disabled={generating || colleges.length === 0}>
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                {t('forecast.refreshing')}
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                {t('forecast.refresh')}
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {colleges.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('forecast.noCollegesYet')}
        </div>
      ) : !forecast ? (
        <div className="rounded-2xl border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">{t('forecast.noForecastYet')}</p>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('forecast.generating')}
              </>
            ) : (
              t('forecast.generateForecast')
            )}
          </Button>
        </div>
      ) : (
        <>
          {stale && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 mb-6 flex-wrap">
              <p className="text-sm text-amber-800">{t('forecast.staleBanner')}</p>
              <Button size="sm" onClick={generate} disabled={generating}>
                {t('forecast.refreshNow')}
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
