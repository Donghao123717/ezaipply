"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { computeProfileSectionsProgress } from '@/lib/profile-schema'
import { loadEssays, wordCount } from '@/lib/essay-store'
import { ESSAY_TASKS } from '@/lib/essay-tasks'
import { loadColleges } from '@/lib/college-store'
import { loadForecast } from '@/lib/forecast-store'

export interface ChecklistItem {
  key: string
  titleKey: string
  subtitleKey: string
  href: string
}

/**
 * "Done" per item is computed client-side from the same localStorage-backed
 * stores the rest of the app uses (Profile, Writing, Colleges, Forecast) -
 * not hardcoded, so a checkmark only shows once that page is actually
 * complete rather than reflecting whatever state it happened to be in when
 * this was last screenshotted for reference.
 */
function computeDone(userId: string): Record<string, boolean> {
  const profile = computeProfileSectionsProgress(userId)
  const essays = loadEssays(userId)
  const colleges = loadColleges(userId)
  const forecast = loadForecast(userId)
  return {
    profile: profile.total > 0 && profile.completed === profile.total,
    writing: ESSAY_TASKS.every((task) => wordCount(essays[task.id]?.html || '') > 0),
    colleges: colleges.length > 0,
    'forecast-submit': forecast !== null && colleges.some((c) => c.submitted),
  }
}

export function Checklist({ items, userId }: { items: ChecklistItem[]; userId: string }) {
  const t = useT()
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setDone(computeDone(userId))
  }, [userId])

  const doneCount = items.filter((i) => done[i.key]).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-primary">{t('home.checklistTitle')}</h2>
          <span className="text-sm text-muted-foreground">
            {doneCount} / {items.length} {t('home.checklistStarted')}
          </span>
        </div>
        <Link href="/counselor" className="text-sm text-primary underline underline-offset-2">
          {t('home.askCounselor')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const isDone = done[item.key] ?? false
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  isDone ? 'bg-primary border-primary' : 'border-muted-foreground/40',
                )}
              >
                {isDone && <Check className="h-3 w-3 text-primary-foreground" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-semibold text-primary leading-tight">{t(item.titleKey)}</span>
                <span className="block text-sm text-muted-foreground mt-0.5">{t(item.subtitleKey)}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
