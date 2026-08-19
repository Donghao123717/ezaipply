"use client"
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SCHOOL_ADMISSIONS_DATA } from '@/lib/school-admissions-data'
import { useT } from '@/lib/i18n/use-t'

function formatRange(range: [number, number] | undefined): string | null {
  if (!range) return null
  return range[0] === range[1] ? String(range[0]) : `${range[0]}-${range[1]}`
}

export function SchoolRequirements({ schoolName }: { schoolName: string }) {
  const t = useT()
  const [open, setOpen] = useState(true)
  const data = SCHOOL_ADMISSIONS_DATA[schoolName]
  if (!data) return null

  const deadlineEntries = [
    data.deadlines.ed && { label: t('colleges.requirements.earlyDecision'), value: data.deadlines.ed },
    data.deadlines.ea && { label: t('colleges.requirements.earlyAction'), value: data.deadlines.ea },
    data.deadlines.rd && { label: t('colleges.requirements.regularDecision'), value: data.deadlines.rd },
  ].filter((e): e is { label: string; value: string } => !!e)

  return (
    <div className="max-w-7xl mx-auto px-6 pt-6">
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-4 px-5 py-3 text-left hover:bg-muted/40"
        >
          <p className="font-semibold text-primary">{t('colleges.requirements.title')}</p>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {open && (
          <div className="px-5 pb-5 space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.requirements.acceptanceRate')}</p>
                <p className="text-lg font-semibold text-primary mt-0.5">{data.acceptanceRate}%</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.requirements.satRange')}</p>
                <p className="text-lg font-semibold text-primary mt-0.5">
                  {data.testBlind ? t('colleges.requirements.testBlind') : formatRange(data.satRange) || t('colleges.requirements.notPublished')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.requirements.actRange')}</p>
                <p className="text-lg font-semibold text-primary mt-0.5">
                  {data.testBlind ? t('colleges.requirements.testBlind') : formatRange(data.actRange) || t('colleges.requirements.notPublished')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.requirements.gpaRange')}</p>
                <p className="text-lg font-semibold text-primary mt-0.5">{formatRange(data.gpaRange) || t('colleges.requirements.notPublished')}</p>
                {data.gpaNote && <p className="text-xs text-muted-foreground mt-0.5">{data.gpaNote}</p>}
              </div>
            </div>

            {deadlineEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('colleges.requirements.deadlines')}</p>
                <div className="flex flex-wrap gap-4">
                  {deadlineEntries.map((d) => (
                    <div key={d.label} className="text-sm">
                      <span className="text-muted-foreground">{d.label}: </span>
                      <span className="font-medium text-primary">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.essaySupplements.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('colleges.requirements.essaySupplements')}</p>
                <div className="space-y-2">
                  {data.essaySupplements.map((s, i) => (
                    <div key={i} className="text-sm rounded-lg bg-secondary/30 px-3 py-2">
                      <span className="text-foreground">{s.prompt}</span>
                      <span className="text-muted-foreground"> ({s.wordLimit} {t('colleges.requirements.words')})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground/70">
              {t('colleges.requirements.dataAsOf').replace('{cycle}', data.cycle)} · {data.sourceNote}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
