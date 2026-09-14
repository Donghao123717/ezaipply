"use client"
import { useMemo } from 'react'
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react'
import { DS160_SECTIONS, SECURITY_SECTION_KEYS } from '@/lib/ds160-schema'
import type { FieldDef } from '@/lib/profile-schema'
import { fieldLabel } from '@/lib/profile-schema'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'

/**
 * The DS-160's security and background questions, on one screen.
 *
 * The real form spreads 27 yes/no questions across five pages, each paired with
 * an explanation box. Every one of them already defaults to "No", which is the
 * honest answer for almost every applicant - so the old layout made a student
 * page through five screens to change nothing.
 *
 * Collapsing them into one list is not only faster, it is safer: these are
 * sworn answers, and a student who can see all 27 at once can actually tell
 * what they are about to declare. The explanation box only appears for a
 * question they flip to Yes, so the page stays readable.
 */
export function SecurityReview({
  data,
  onChange,
  onAffirmAll,
  allConfirmed,
}: {
  data: Record<string, Record<string, string> | Record<string, string>[]>
  onChange: (sectionKey: string, fieldKey: string, value: string) => void
  onAffirmAll: () => void
  allConfirmed: boolean
}) {
  const t = useT()

  const parts = useMemo(
    () =>
      SECURITY_SECTION_KEYS.map((key) => {
        const section = DS160_SECTIONS.find((s) => s.key === key)
        if (!section || section.def.kind !== 'simple') return null
        const fields = section.def.groups.flatMap((g) => g.fields)
        // Questions are the radios; each one's explanation field is the
        // matching "<key>Explain" beside it.
        const questions = fields.filter((f) => f.type === 'radio')
        const explains = new Map(fields.filter((f) => f.key.endsWith('Explain')).map((f) => [f.key, f]))
        return { key, labelKey: section.labelKey, questions, explains }
      }).filter(Boolean) as {
        key: string
        labelKey: string
        questions: FieldDef[]
        explains: Map<string, FieldDef>
      }[],
    [],
  )

  const total = parts.reduce((n, p) => n + p.questions.length, 0)
  const flagged = parts.reduce(
    (n, p) => n + p.questions.filter((q) => (data[p.key] as Record<string, string>)?.[q.key] === 'Yes').length,
    0,
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary">{t('ds160.security.title')}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t('ds160.security.intro')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-primary">
            {t('ds160.security.countLine').replace('{total}', String(total))}
          </p>
          <p className={cn('text-xs', flagged > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground')}>
            {flagged > 0
              ? t('ds160.security.flaggedLine').replace('{n}', String(flagged))
              : t('ds160.security.allNo')}
          </p>
        </div>
      </div>

      {/* One affirmation instead of five page confirmations. */}
      <div
        className={cn(
          'mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
          allConfirmed ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-accent/40 bg-accent/5',
        )}
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {allConfirmed ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />
          )}
          {allConfirmed ? t('ds160.security.confirmedNote') : t('ds160.security.affirmNote')}
        </span>
        <Button size="sm" onClick={onAffirmAll} disabled={allConfirmed}>
          {allConfirmed ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {t('ds160.security.confirmed')}
            </>
          ) : (
            t('ds160.security.affirmAll')
          )}
        </Button>
      </div>

      <div className="space-y-8">
        {parts.map((part) => (
          <section key={part.key}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t(part.labelKey)}
            </h3>
            <div className="divide-y rounded-xl border">
              {part.questions.map((q) => {
                const value = (data[part.key] as Record<string, string>)?.[q.key] ?? 'No'
                const isYes = value === 'Yes'
                const explain = part.explains.get(`${q.key}Explain`)
                return (
                  <div key={q.key} className={cn('px-4 py-3', isYes && 'bg-amber-500/5')}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="flex-1 text-sm leading-relaxed text-foreground">{fieldLabel(q, t)}</p>
                      <div className="flex shrink-0 gap-1" role="group" aria-label={fieldLabel(q, t)}>
                        {['No', 'Yes'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            aria-pressed={value === opt}
                            onClick={() => onChange(part.key, q.key, opt)}
                            className={cn(
                              'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                              value === opt
                                ? opt === 'Yes'
                                  ? 'border-amber-500 bg-amber-500 text-white'
                                  : 'border-primary bg-primary text-primary-foreground'
                                : 'border-input text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {t(`common.options.${opt}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Only a Yes needs an explanation, so the other 26 rows stay one line. */}
                    {isYes && explain && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {fieldLabel(explain, t)}
                        </label>
                        <textarea
                          value={(data[part.key] as Record<string, string>)?.[explain.key] || ''}
                          onChange={(e) => onChange(part.key, explain.key, e.target.value)}
                          className="min-h-20 w-full resize-y rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Re-exported so the workspace can collapse the same five pages. */
export { SECURITY_SECTION_KEYS }
