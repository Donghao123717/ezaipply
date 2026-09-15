"use client"
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Pencil, SkipForward } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import {
  answeredCount,
  loadPreferences,
  savePreferences,
  PREFERENCE_QUESTION_COUNT,
  type CollegePreferences,
} from '@/lib/college-preferences'

/**
 * The questions a counsellor asks before suggesting anywhere, asked one at a
 * time.
 *
 * This was nine rows of chips on one panel, and it read like a form because it
 * was one - nine questions in front of you at once is a chore to start and easy
 * to abandon halfway. One question at a time, in the counsellor's voice, is the
 * same data and a different experience: each answer is a single tap, the deck
 * moves on by itself, and the whole thing is over in under a minute.
 *
 * Nothing is required. Skipping means the dimension is not scored at all rather
 * than scored against you, so a student who does not care where they live does
 * not quietly lose the Midwest - and that is worth saying on screen, because a
 * student who thinks skipping hurts them will answer at random instead.
 */

type StepKind = 'text' | 'choice' | 'multi'

interface Step {
  key: string
  kind: StepKind
  /** Reads the current answer back for the summary row. */
  read: (p: CollegePreferences) => string | undefined
  choices?: { value: string; labelKey: string }[]
  apply?: (p: CollegePreferences, value: string | undefined) => CollegePreferences
}

const REGION_VALUES = ['northeast', 'mid-atlantic', 'south', 'midwest', 'mountain', 'west']

const STEPS: Step[] = [
  {
    key: 'major',
    kind: 'text',
    read: (p) => p.intendedMajor,
    apply: (p, v) => ({ ...p, intendedMajor: v || undefined }),
  },
  {
    key: 'budget',
    kind: 'choice',
    choices: [
      { value: '50', labelKey: 'colleges.prefs.budgetLow' },
      { value: '70', labelKey: 'colleges.prefs.budgetMid' },
      { value: '95', labelKey: 'colleges.prefs.budgetHigh' },
    ],
    read: (p) =>
      p.budgetPerYear === undefined ? undefined : String(p.budgetPerYear),
    apply: (p, v) => ({ ...p, budgetPerYear: v ? Number(v) : undefined }),
  },
  {
    key: 'scholarship',
    kind: 'choice',
    choices: [
      { value: 'yes', labelKey: 'common.options.Yes' },
      { value: 'no', labelKey: 'common.options.No' },
    ],
    read: (p) => (p.needsScholarship === undefined ? undefined : p.needsScholarship ? 'yes' : 'no'),
    apply: (p, v) => ({ ...p, needsScholarship: v === undefined ? undefined : v === 'yes' }),
  },
  {
    key: 'classSize',
    kind: 'choice',
    choices: [
      { value: 'small', labelKey: 'colleges.prefs.classSmall' },
      { value: 'large', labelKey: 'colleges.prefs.classLarge' },
    ],
    read: (p) => p.classSize,
    apply: (p, v) => ({ ...p, classSize: v as CollegePreferences['classSize'] }),
  },
  {
    key: 'after',
    kind: 'choice',
    choices: [
      { value: 'work', labelKey: 'colleges.prefs.afterWork' },
      { value: 'masters', labelKey: 'colleges.prefs.afterMasters' },
      { value: 'phd', labelKey: 'colleges.prefs.afterPhd' },
    ],
    read: (p) => p.afterGraduation,
    apply: (p, v) => ({ ...p, afterGraduation: v as CollegePreferences['afterGraduation'] }),
  },
  {
    key: 'climate',
    kind: 'choice',
    choices: [
      { value: 'warm', labelKey: 'colleges.prefs.climateWarm' },
      { value: 'cold-ok', labelKey: 'colleges.prefs.climateCold' },
    ],
    read: (p) => p.climate,
    apply: (p, v) => ({ ...p, climate: v as CollegePreferences['climate'] }),
  },
  {
    key: 'coastal',
    kind: 'choice',
    choices: [
      { value: 'coast', labelKey: 'colleges.prefs.coast' },
      { value: 'inland', labelKey: 'colleges.prefs.inland' },
    ],
    read: (p) => p.coastal,
    apply: (p, v) => ({ ...p, coastal: v as CollegePreferences['coastal'] }),
  },
  {
    key: 'setting',
    kind: 'choice',
    choices: [
      { value: 'big-city', labelKey: 'colleges.prefs.bigCity' },
      { value: 'college-town', labelKey: 'colleges.prefs.collegeTown' },
    ],
    read: (p) => p.setting,
    apply: (p, v) => ({ ...p, setting: v as CollegePreferences['setting'] }),
  },
  {
    key: 'regions',
    kind: 'multi',
    choices: REGION_VALUES.map((v) => ({
      value: v,
      labelKey: `colleges.prefs.region${v.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`,
    })),
    read: (p) => (p.regions?.length ? p.regions.join(',') : undefined),
  },
]

export function PreferenceIntake({
  userId,
  onChange,
}: {
  userId: string
  onChange?: (prefs: CollegePreferences) => void
}) {
  const t = useT()
  const [prefs, setPrefs] = useState<CollegePreferences>({})
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [entering, setEntering] = useState(true)

  useEffect(() => {
    const loaded = loadPreferences(userId)
    setPrefs(loaded)
    onChange?.(loaded)
    // Someone who has been through this before lands on the summary, not back
    // at question one.
    setDone(answeredCount(loaded) > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function commit(next: CollegePreferences) {
    setPrefs(next)
    savePreferences(userId, next)
    onChange?.(next)
  }

  function advance() {
    if (step >= STEPS.length - 1) {
      setDone(true)
      return
    }
    // Re-trigger the entry animation on the next card.
    setEntering(false)
    setStep((s) => s + 1)
    window.setTimeout(() => setEntering(true), 20)
  }

  const current = STEPS[step]
  const answered = answeredCount(prefs)
  const answeredHere = current ? current.read(prefs) : undefined

  const summary = useMemo(
    () =>
      STEPS.map((s, i) => ({
        index: i,
        key: s.key,
        value: s.read(prefs),
      })),
    [prefs],
  )

  if (done) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">{t('colleges.prefs.summaryTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('colleges.prefs.answered')
                .replace('{n}', String(answered))
                .replace('{total}', String(PREFERENCE_QUESTION_COUNT))}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep(0)
              setDone(false)
              setEntering(true)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/60 hover:text-primary"
          >
            <Pencil className="h-3 w-3" />
            {t('colleges.prefs.review')}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {summary.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => {
                setStep(row.index)
                setDone(false)
                setEntering(true)
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                row.value
                  ? 'border-accent/45 bg-accent/10 text-primary'
                  : 'border-dashed text-muted-foreground hover:border-accent/50',
              )}
            >
              {t(`colleges.prefs.${row.key}Short`)}
              {row.value ? <Check className="ml-1 inline h-3 w-3 text-accent" /> : null}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Progress as a thin rule rather than a counter: it marks where you are
          without making nine questions feel like nine. */}
      <div className="flex gap-1 px-4 pt-4">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              'h-0.5 flex-1 rounded-full transition-colors duration-300',
              i < step ? 'bg-accent' : i === step ? 'bg-accent/50' : 'bg-muted-foreground/15',
            )}
          />
        ))}
      </div>

      <div
        key={current.key}
        className={cn(
          'px-4 pb-4 pt-4 motion-reduce:!opacity-100 motion-reduce:!transform-none',
          entering ? 'animate-fade-in-up' : 'opacity-0',
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          {t('colleges.prefs.counsellorAsks')}
        </p>
        <p className="mt-1 font-display text-lg leading-snug text-primary">
          {t(`colleges.prefs.${current.key}Question`)}
        </p>
        {current.key === 'major' && (
          <p className="mt-1 text-xs text-muted-foreground">{t('colleges.prefs.majorHint')}</p>
        )}

        <div className="mt-3">
          {current.kind === 'text' && (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                defaultValue={prefs.intendedMajor || ''}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  commit({ ...prefs, intendedMajor: (e.target as HTMLInputElement).value.trim() || undefined })
                  advance()
                }}
                onBlur={(e) =>
                  commit({ ...prefs, intendedMajor: e.target.value.trim() || undefined })
                }
                placeholder={t('colleges.prefs.majorPlaceholder')}
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={advance}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                {t('colleges.prefs.next')}
              </button>
            </div>
          )}

          {current.kind === 'choice' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {current.choices!.map((choice) => {
                const active = answeredHere === choice.value
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => {
                      commit(current.apply!(prefs, active ? undefined : choice.value))
                      if (!active) advance()
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left text-sm transition-all',
                      active
                        ? 'border-accent bg-accent/10 font-medium text-primary'
                        : 'hover:border-accent/50 hover:bg-muted/40',
                    )}
                  >
                    {t(choice.labelKey)}
                  </button>
                )
              })}
            </div>
          )}

          {current.kind === 'multi' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {current.choices!.map((choice) => {
                  const active = prefs.regions?.includes(choice.value)
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => {
                        const list = prefs.regions || []
                        commit({
                          ...prefs,
                          regions: active ? list.filter((x) => x !== choice.value) : [...list, choice.value],
                        })
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        active
                          ? 'border-accent bg-accent/15 font-medium text-accent'
                          : 'text-muted-foreground hover:border-accent/50',
                      )}
                    >
                      {t(choice.labelKey)}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={advance}
                className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                {t('colleges.prefs.finish')}
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary disabled:invisible"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('colleges.prefs.back')}
          </button>
          <button
            type="button"
            onClick={advance}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {t('colleges.prefs.skip')}
            <SkipForward className="h-3 w-3" />
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/80">{t('colleges.prefs.footnote')}</p>
      </div>
    </div>
  )
}
