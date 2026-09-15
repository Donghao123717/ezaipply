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
    // A frame of its own. On the cream page the four tiles were white cards
    // floating next to a white carousel card, so the eye had no way to tell
    // where the checklist ended - everything read as one busy field. The
    // checklist now sits on white and its tiles take the page's cream, which
    // inverts the contrast inside the frame and makes the zone legible.
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
              className="group block rounded-xl border border-transparent bg-background p-4 transition-colors hover:border-primary/40"
            >
              {/* Title row first, subtitle across the full width underneath.
                  Sharing one row with the tick and the arrow left the subtitle
                  a column about two words wide, and "Details you reuse" came
                  out as three ragged lines. */}
              <span className="flex items-start gap-2">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    isDone ? 'bg-primary border-primary' : 'border-muted-foreground/40',
                  )}
                >
                  {isDone && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <span className="min-w-0 flex-1 font-display font-semibold leading-tight text-primary">
                  {t(item.titleKey)}
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{t(item.subtitleKey)}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
