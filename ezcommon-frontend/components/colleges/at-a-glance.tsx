"use client"
import { useEffect, useState } from 'react'
import type { SavedCollege } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import { computeApplicationProgress, STATUS_LABEL_KEY, type ApplicationStatus } from '@/lib/application-status'
import { useT } from '@/lib/i18n/use-t'

const BUCKET_ORDER: ApplicationStatus[] = ['not_started', 'getting_started', 'in_progress', 'almost_done', 'complete']
const BUCKET_COLOR: Record<ApplicationStatus, string> = {
  not_started: 'bg-muted-foreground/40',
  getting_started: 'bg-sky-400',
  in_progress: 'bg-amber-400',
  almost_done: 'bg-orange-400',
  complete: 'bg-emerald-500',
}

export function AtAGlance({ userId, colleges }: { userId: string; colleges: SavedCollege[] }) {
  const t = useT()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  const reach = colleges.filter((c) => c.category === 'reach').length
  const target = colleges.filter((c) => c.category === 'target').length
  const safety = colleges.filter((c) => c.category === 'safety').length
  const total = colleges.length

  const counts: Record<ApplicationStatus, number> = {
    not_started: 0,
    getting_started: 0,
    in_progress: 0,
    almost_done: 0,
    complete: 0,
  }
  if (ready) {
    for (const college of colleges) {
      counts[computeApplicationProgress(userId, college.id).status] += 1
    }
  } else {
    counts.not_started = total
  }

  const buckets = BUCKET_ORDER.map((status) => ({
    label: t(STATUS_LABEL_KEY[status]),
    count: counts[status],
    color: BUCKET_COLOR[status],
  }))

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4 mb-6">
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t('colleges.atAGlance.eyebrow')}</p>
        <h1 className="font-display text-3xl font-semibold text-primary mb-2">{t('colleges.atAGlance.title')}</h1>
        <p className="text-sm text-muted-foreground mb-4">{t('colleges.atAGlance.subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium">{t('colleges.atAGlance.collegesCount').replace('{count}', String(total))}</span>
          <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-violet-600">{reach} {t(CATEGORY_LABEL_KEY.reach)}</span>
          <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">{target} {t(CATEGORY_LABEL_KEY.target)}</span>
          <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-emerald-600">{safety} {t(CATEGORY_LABEL_KEY.safety)}</span>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.atAGlance.applicationProgress')}</p>
        <p className="text-sm font-medium text-primary mb-3">{t('colleges.atAGlance.whereSchoolsStand')}</p>
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          {buckets.map((b) => (
            <div
              key={b.label}
              className={b.color}
              style={{ width: total > 0 ? `${(b.count / total) * 100}%` : '0%' }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {buckets.map((b) => (
            <span key={b.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${b.color}`} />
              {b.label} · {b.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
