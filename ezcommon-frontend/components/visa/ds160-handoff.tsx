"use client"
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, ChevronRight, ExternalLink, Pencil, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { Button } from '@/components/ui/button'
import { DS160_SECTIONS, type Ds160SectionMeta } from '@/lib/ds160-schema'
import { DO_NOT_KNOW, DOES_NOT_APPLY, fieldLabel, isNotApplicable } from '@/lib/profile-schema'
import type { Ds160Data } from '@/lib/ds160-store'
import { loadVisaPrep, saveVisaPrep, type PassportReturn, type VisaPrepData } from '@/lib/visa-prep-store'

/**
 * The last screen before the applicant goes to the government site.
 *
 * Two jobs. First, show them the whole form the way a form looks, because they
 * have answered most of it by talking and nobody should sign something they
 * have only heard. Second, hand it over honestly: this is prepared here and
 * submitted there, by them.
 *
 * What we do not do is submit it, and we do not book the appointment. Both
 * mean driving a government site with the applicant's identity, and the second
 * is the visa-slot-bot pattern besides. What we can do is hold the pieces -
 * the application ID the site issues, when the interview is, and how they want
 * the passport back - so none of it is on a scrap of paper.
 */

const CEAC_URL = 'https://ceac.state.gov/genniv/'

export function Ds160Handoff({
  userId,
  data,
  sections,
  onEditPage,
}: {
  userId: string
  data: Ds160Data
  sections: Ds160SectionMeta[]
  onEditPage: (section: string) => void
}) {
  const t = useT()
  const [prep, setPrep] = useState<VisaPrepData | null>(null)

  useEffect(() => {
    setPrep(loadVisaPrep(userId))
  }, [userId])

  function update(patch: Partial<VisaPrepData>) {
    setPrep((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      saveVisaPrep(userId, next)
      return next
    })
  }

  /** Every answered field, page by page, plus what is still blank. */
  const pages = useMemo(() => {
    return sections
      .filter((section) => section.def.kind === 'simple' && section.key !== 'photo')
      .map((section) => {
        const sectionData = (data[section.key] as Record<string, any>) || {}
        const rows: { label: string; value: string; muted?: boolean }[] = []
        const missing: string[] = []
        for (const group of (section.def as any).groups || []) {
          for (const field of group.fields) {
            const value = sectionData[field.key]
            const text = typeof value === 'string' ? value.trim() : ''
            if (!text) {
              // Named, not counted. "3 blank" tells the applicant there is a
              // problem; the name of the field tells them what to go and find.
              if (field.required) missing.push(fieldLabel(field, t))
              continue
            }
            // A ticked "does not apply" box is an answer, and reads as one -
            // the raw sentinel in a review of a legal form would look like a bug.
            rows.push({
              label: fieldLabel(field, t),
              value: isNotApplicable(text)
                ? t(text === DO_NOT_KNOW ? 'common.doNotKnow' : 'common.doesNotApply')
                : text,
              muted: isNotApplicable(text),
            })
          }
        }
        return { key: section.key, label: t(section.labelKey), rows, missing }
      })
      .filter((page) => page.rows.length > 0 || page.missing.length > 0)
  }, [data, sections, t])

  const totalBlanks = pages.reduce((n, p) => n + p.missing.length, 0)
  const applicationId = ((data.setup as Record<string, any>) || {}).applicationId || ''
  const ready = totalBlanks === 0

  if (!prep) return null

  return (
    <div className="space-y-6">
      {/* Where they stand, said plainly. */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3',
          ready ? 'border-emerald-200 bg-emerald-50/50' : 'border-accent/40 bg-accent/5',
        )}
      >
        {ready ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        )}
        <p className="text-sm text-muted-foreground">
          {ready
            ? t('ds160.handoff.ready')
            : t('ds160.handoff.blanks').replace('{count}', String(totalBlanks))}
        </p>
      </div>

      {/* The form, as a form. */}
      <div className="space-y-4">
        {pages.map((page) => (
          <section key={page.key} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-primary">{page.label}</h3>
                {page.missing.length > 0 && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                    {t('ds160.handoff.pageBlanks').replace('{count}', String(page.missing.length))}
                  </span>
                )}
              </div>
              <button
                onClick={() => onEditPage(page.key)}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-3 w-3" />
                {t('ds160.handoff.edit')}
              </button>
            </div>
            {page.missing.length > 0 && (
              <div className="border-b border-accent/20 bg-accent/5 px-4 py-2.5">
                <p className="mb-1 text-xs font-semibold text-accent">{t('ds160.handoff.missingHere')}</p>
                <ul className="space-y-0.5">
                  {page.missing.map((label) => (
                    <li key={label} className="text-xs text-muted-foreground">
                      · {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <dl className="divide-y">
              {page.rows.map((row, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-2">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd
                    className={cn(
                      'max-w-[60%] break-words text-right text-sm',
                      row.muted ? 'italic text-muted-foreground' : 'text-primary',
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/* The handover. */}
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-1 font-semibold text-primary">{t('ds160.handoff.submitTitle')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('ds160.handoff.submitBody')}</p>

        <ol className="mb-5 space-y-2.5">
          {['one', 'two', 'three', 'four'].map((step, i) => (
            <li key={step} className="flex gap-2.5 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{t(`ds160.handoff.step.${step}`)}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <a href={CEAC_URL} target="_blank" rel="noreferrer noopener">
              {t('ds160.handoff.openCeac')}
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
          {applicationId && (
            <span className="rounded-lg border bg-background px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t('ds160.handoff.applicationId')}</span>
              <span className="ml-2 font-mono font-semibold text-primary">{applicationId}</span>
            </span>
          )}
        </div>

        {!applicationId && (
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            {t('ds160.handoff.noApplicationId')}
          </p>
        )}
      </section>

      {/* After the form: the interview, and getting the passport back. */}
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-1 font-semibold text-primary">{t('ds160.handoff.appointmentTitle')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('ds160.handoff.appointmentBody')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('ds160.handoff.appointmentDate')}
            </span>
            <input
              type="date"
              value={prep.appointmentDate}
              onChange={(e) => update({ appointmentDate: e.target.value })}
              className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('ds160.handoff.appointmentTime')}
            </span>
            <input
              type="time"
              value={prep.appointmentTime}
              onChange={(e) => update({ appointmentTime: e.target.value })}
              className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('ds160.handoff.returnTitle')}
          </span>
          <div className="flex flex-wrap gap-2">
            {(['pickup', 'courier'] as PassportReturn[]).map((option) => (
              <button
                key={option}
                onClick={() => update({ passportReturn: option })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-colors',
                  prep.passportReturn === option
                    ? 'border-primary bg-secondary font-medium text-primary'
                    : 'text-muted-foreground hover:border-primary',
                )}
              >
                {t(`ds160.handoff.return.${option}`)}
              </button>
            ))}
          </div>
          {prep.passportReturn && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                {t(`ds160.handoff.returnAddress.${prep.passportReturn}`)}
              </span>
              <input
                value={prep.returnAddress}
                onChange={(e) => update({ returnAddress: e.target.value })}
                className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('ds160.handoff.bookingNote')}
        </p>
      </section>
    </div>
  )
}
