"use client"
import { Wallet } from 'lucide-react'
import { SCHOOL_FIT } from '@/lib/school-fit-data'
import { useT } from '@/lib/i18n/use-t'

/**
 * What a year here costs, shown where the student is about to spend an evening
 * on the application.
 *
 * This is the figure a school puts on an I-20 as estimated annual expenses -
 * tuition, fees, housing, food, insurance - not tuition alone, because tuition
 * alone is the number that makes a $45k public look like a $30k one. It is an
 * estimate and labelled as one: a student should use it to decide whether to
 * spend the evening, and the school's own cost page to decide anything else.
 */
export function CostEstimate({ schoolName }: { schoolName: string }) {
  const t = useT()
  const fit = SCHOOL_FIT[schoolName]
  if (!fit?.costPerYear) return null

  const total = fit.costPerYear
  const four = total * 4
  const merit = {
    meaningful: t('applicationForm.cost.meritMeaningful'),
    limited: t('applicationForm.cost.meritLimited'),
    none: t('applicationForm.cost.meritNone'),
  }[fit.meritAid]

  return (
    <div className="mx-auto mt-4 max-w-7xl px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('applicationForm.cost.title')}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-primary">${total}k</span>
          <span className="text-xs text-muted-foreground">{t('applicationForm.cost.perYear')}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium tabular-nums text-primary/80">${four}k</span>
          <span className="text-xs text-muted-foreground">{t('applicationForm.cost.fourYears')}</span>
        </div>
        <span className="text-xs text-muted-foreground">{merit}</span>
        <span className="ml-auto text-[11px] text-muted-foreground/80">
          {t('applicationForm.cost.note')}
        </span>
      </div>
    </div>
  )
}
