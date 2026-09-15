"use client"
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
 * The questions a counsellor asks before suggesting anywhere.
 *
 * Deliberately a set of chips rather than a chat. A conversation would be
 * warmer, but a student filling this in wants it over in a minute, and every
 * answer here has to map onto a field the ranking can actually use - a free
 * text reply about "somewhere with good weather and good food" does not.
 *
 * Nothing is required. Skipping a question means it is not scored at all
 * rather than scored against you, so an impatient student still gets a list
 * built on their scores and their major.
 */

type Choice<T extends string> = { value: T; labelKey: string }

function ChipRow<T extends string>({
  value,
  choices,
  onPick,
}: {
  value: T | undefined
  choices: Choice<T>[]
  onPick: (next: T | undefined) => void
}) {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const active = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            // Tapping the active chip clears it - "I don't mind" needs to be
            // reachable, and it is not the same answer as either option.
            onClick={() => onPick(active ? undefined : c.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              active
                ? 'border-accent bg-accent/15 font-medium text-accent'
                : 'border-border bg-background text-muted-foreground hover:border-accent/50',
            )}
          >
            {t(c.labelKey)}
          </button>
        )
      })}
    </div>
  )
}

const REGIONS = [
  { value: 'northeast', labelKey: 'colleges.prefs.regionNortheast' },
  { value: 'mid-atlantic', labelKey: 'colleges.prefs.regionMidAtlantic' },
  { value: 'south', labelKey: 'colleges.prefs.regionSouth' },
  { value: 'midwest', labelKey: 'colleges.prefs.regionMidwest' },
  { value: 'mountain', labelKey: 'colleges.prefs.regionMountain' },
  { value: 'west', labelKey: 'colleges.prefs.regionWest' },
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const loaded = loadPreferences(userId)
    setPrefs(loaded)
    onChange?.(loaded)
    // Open on first visit, when there is nothing to show yet.
    if (!answeredCount(loaded)) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function update(patch: Partial<CollegePreferences>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    savePreferences(userId, next)
    onChange?.(next)
  }

  const answered = answeredCount(prefs)

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{t('colleges.prefs.title')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {answered
              ? t('colleges.prefs.answered')
                  .replace('{n}', String(answered))
                  .replace('{total}', String(PREFERENCE_QUESTION_COUNT))
              : t('colleges.prefs.blurb')}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.major')}</p>
            <input
              type="text"
              value={prefs.intendedMajor || ''}
              onChange={(e) => update({ intendedMajor: e.target.value })}
              placeholder={t('colleges.prefs.majorPlaceholder')}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t('colleges.prefs.majorHint')}</p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.budget')}</p>
            <ChipRow
              value={
                prefs.budgetPerYear === undefined
                  ? undefined
                  : prefs.budgetPerYear <= 50
                    ? 'low'
                    : prefs.budgetPerYear <= 70
                      ? 'mid'
                      : 'high'
              }
              choices={[
                { value: 'low', labelKey: 'colleges.prefs.budgetLow' },
                { value: 'mid', labelKey: 'colleges.prefs.budgetMid' },
                { value: 'high', labelKey: 'colleges.prefs.budgetHigh' },
              ]}
              onPick={(v) =>
                update({ budgetPerYear: v === 'low' ? 50 : v === 'mid' ? 70 : v === 'high' ? 95 : undefined })
              }
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.scholarship')}</p>
            <ChipRow
              value={prefs.needsScholarship === undefined ? undefined : prefs.needsScholarship ? 'yes' : 'no'}
              choices={[
                { value: 'yes', labelKey: 'common.options.Yes' },
                { value: 'no', labelKey: 'common.options.No' },
              ]}
              onPick={(v) => update({ needsScholarship: v === undefined ? undefined : v === 'yes' })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.classSize')}</p>
            <ChipRow
              value={prefs.classSize}
              choices={[
                { value: 'small', labelKey: 'colleges.prefs.classSmall' },
                { value: 'large', labelKey: 'colleges.prefs.classLarge' },
              ]}
              onPick={(v) => update({ classSize: v })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.after')}</p>
            <ChipRow
              value={prefs.afterGraduation}
              choices={[
                { value: 'work', labelKey: 'colleges.prefs.afterWork' },
                { value: 'masters', labelKey: 'colleges.prefs.afterMasters' },
                { value: 'phd', labelKey: 'colleges.prefs.afterPhd' },
              ]}
              onPick={(v) => update({ afterGraduation: v })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.climate')}</p>
            <ChipRow
              value={prefs.climate}
              choices={[
                { value: 'warm', labelKey: 'colleges.prefs.climateWarm' },
                { value: 'cold-ok', labelKey: 'colleges.prefs.climateCold' },
              ]}
              onPick={(v) => update({ climate: v })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.coastal')}</p>
            <ChipRow
              value={prefs.coastal}
              choices={[
                { value: 'coast', labelKey: 'colleges.prefs.coast' },
                { value: 'inland', labelKey: 'colleges.prefs.inland' },
              ]}
              onPick={(v) => update({ coastal: v })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.setting')}</p>
            <ChipRow
              value={prefs.setting}
              choices={[
                { value: 'big-city', labelKey: 'colleges.prefs.bigCity' },
                { value: 'college-town', labelKey: 'colleges.prefs.collegeTown' },
              ]}
              onPick={(v) => update({ setting: v })}
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-primary">{t('colleges.prefs.regions')}</p>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => {
                const active = prefs.regions?.includes(r.value)
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      const current = prefs.regions || []
                      update({
                        regions: active ? current.filter((x) => x !== r.value) : [...current, r.value],
                      })
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      active
                        ? 'border-accent bg-accent/15 font-medium text-accent'
                        : 'border-border bg-background text-muted-foreground hover:border-accent/50',
                    )}
                  >
                    {t(r.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground sm:col-span-2">{t('colleges.prefs.footnote')}</p>
        </div>
      )}
    </div>
  )
}
