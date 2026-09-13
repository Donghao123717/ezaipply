"use client"
import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { CATEGORY_LABEL_KEY, type CollegeCategory } from '@/lib/college-store'
import {
  loadRecommendations,
  saveRecommendations,
  type RecommendationSet,
  type RecommendedCollege,
} from '@/lib/recommendation-store'
import { COLLEGES_DATABASE } from '@/lib/colleges-database'
import { computeProfileStrength } from '@/lib/profile-strength'
import { computeStudentScores } from '@/lib/student-scores'
import { loadProfileContext } from '@/lib/essay-store'

const CATEGORY_STYLE: Record<CollegeCategory, string> = {
  reach: 'bg-rose-50 text-rose-700 border-rose-200',
  target: 'bg-amber-50 text-amber-700 border-amber-200',
  safety: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function RecommendedColleges({
  userId,
  savedNames,
  onAccept,
}: {
  userId: string
  savedNames: Set<string>
  onAccept: (picks: RecommendedCollege[]) => void
}) {
  const t = useT()
  const [set, setSet] = useState<RecommendationSet | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSet(loadRecommendations(userId))
  }, [userId])

  // A school the student added by hand is no longer a useful suggestion.
  const visible = useMemo(
    () => (set?.items || []).filter((item) => !savedNames.has(item.name)),
    [set, savedNames],
  )

  function persist(next: RecommendationSet | null) {
    setSet(next)
    saveRecommendations(userId, next)
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const scores = computeStudentScores(userId)
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/colleges/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_context: loadProfileContext(userId),
          profile_strength: computeProfileStrength(userId),
          student_sat: scores.sat ?? null,
          student_act: scores.act ?? null,
          student_gpa: scores.gpa4 ?? null,
          saved_names: Array.from(savedNames),
          candidates: COLLEGES_DATABASE.map((c) => ({
            name: c.name,
            acceptance_rate: c.acceptanceRate,
          })),
          count: 8,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const items: RecommendedCollege[] = (data.recommendations || []).map((r: any) => ({
        name: r.name,
        category: r.category,
        rationale: r.rationale,
        acceptanceRate: r.acceptance_rate,
      }))
      persist({ generatedAt: new Date().toISOString(), items })
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : t('colleges.recommend.error'))
    } finally {
      setLoading(false)
    }
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function dismiss(name: string) {
    setLeaving((prev) => new Set(prev).add(name))
    // Let the exit animation finish before dropping the card from state.
    setTimeout(() => {
      persist(set ? { ...set, items: set.items.filter((i) => i.name !== name) } : null)
      setLeaving((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }, 250)
  }

  function acceptSelected() {
    const picks = visible.filter((i) => selected.has(i.name))
    if (picks.length === 0) return
    setLeaving(new Set(picks.map((p) => p.name)))
    setTimeout(() => {
      onAccept(picks)
      persist(set ? { ...set, items: set.items.filter((i) => !selected.has(i.name)) } : null)
      setSelected(new Set())
      setLeaving(new Set())
    }, 250)
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden mb-6">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b">
        <div>
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            {visible.length > 0
              ? t('colleges.recommend.titleWithCount').replace('{count}', String(visible.length))
              : t('colleges.recommend.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('colleges.recommend.subtitle')}</p>
        </div>
        {visible.length > 0 && (
          <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="shrink-0">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
            {t('colleges.recommend.update')}
          </Button>
        )}
      </div>

      {loading && visible.length === 0 && (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl border bg-muted/30 h-16"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/60 to-transparent" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-1">{t('colleges.recommend.loading')}</p>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="px-5 py-10 text-center">
          <p className="font-medium text-primary">{t('colleges.recommend.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{t('colleges.recommend.emptyBody')}</p>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          <Button onClick={generate} disabled={loading} className="mt-4">
            {t('colleges.recommend.cta')}
          </Button>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <ul className="divide-y">
            {visible.map((item, index) => {
              const isSelected = selected.has(item.name)
              const isLeaving = leaving.has(item.name)
              return (
                <li
                  key={item.name}
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                  className={cn(
                    'group flex items-start gap-3 px-5 py-3 transition-colors motion-reduce:animate-none',
                    isLeaving ? 'animate-fade-out-right' : 'animate-fade-in-up',
                    isSelected ? 'bg-accent/5' : 'hover:bg-muted/40',
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={item.name}
                    onClick={() => toggle(item.name)}
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected ? 'bg-primary border-primary scale-105' : 'border-input bg-background',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3 w-3 text-primary-foreground transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>

                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle(item.name)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-primary text-sm">{item.name}</p>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          CATEGORY_STYLE[item.category],
                        )}
                      >
                        {t(CATEGORY_LABEL_KEY[item.category])}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {t('colleges.recommend.admitRate').replace('{rate}', String(Math.round(item.acceptanceRate)))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.rationale}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismiss(item.name)}
                    aria-label={t('colleges.recommend.dismiss')}
                    className="mt-0.5 rounded p-1 text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground hover:bg-muted transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between gap-4 px-5 py-3 border-t bg-muted/30">
            <div>
              <p className="text-sm font-medium text-primary tabular-nums">
                {t('colleges.recommend.selectedCount').replace('{count}', String(selected.size))}
              </p>
              <p className="text-xs text-muted-foreground">{t('colleges.recommend.reviewHint')}</p>
            </div>
            <Button
              onClick={acceptSelected}
              disabled={selected.size === 0}
              className={cn('shrink-0 transition-all', selected.size > 0 && 'animate-slide-up-in')}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {t('colleges.recommend.moveToList')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
