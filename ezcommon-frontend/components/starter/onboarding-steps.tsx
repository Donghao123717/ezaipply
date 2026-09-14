"use client"
import React from 'react'
import { useT } from '@/lib/i18n/use-t'

type StepKey = 'profile' | 'education' | 'activity' | 'testing' | 'review'

/** Matches the order the review screens actually advance through. */
const ORDER: { key: StepKey; labelKey: string }[] = [
  { key: 'profile', labelKey: 'starter.sections.profile.step' },
  { key: 'education', labelKey: 'starter.sections.education.step' },
  { key: 'activity', labelKey: 'starter.sections.activity.step' },
  { key: 'testing', labelKey: 'starter.sections.testing.step' },
  { key: 'review', labelKey: 'starter.steps.review' },
]

export function OnboardingSteps({ current }: { current: StepKey }) {
  const t = useT()
  const currentIndex = ORDER.findIndex((s) => s.key === current)

  return (
    <div className="mb-4 text-base sm:text-lg">
      <nav aria-label={t('starter.steps.label')} className="flex flex-wrap items-center gap-3 sm:gap-4">
        {ORDER.map((s, idx) => (
          <React.Fragment key={s.key}>
            <span
              aria-current={s.key === current ? 'step' : undefined}
              className={
                s.key === current
                  ? 'font-semibold text-primary'
                  : // Steps already passed read as done rather than pending.
                    idx < currentIndex
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60'
              }
            >
              {t(s.labelKey)}
            </span>
            {idx < ORDER.length - 1 && <span aria-hidden className="text-muted-foreground/40">-</span>}
          </React.Fragment>
        ))}
      </nav>
    </div>
  )
}
