"use client"
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApplicationCycle, SavedCollege } from '@/lib/college-store'
import { CYCLES, PORTAL_LABEL_KEY, resolvePortal } from '@/lib/college-store'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useT } from '@/lib/i18n/use-t'

export function ApplicationsList({
  colleges,
  onToggleSubmitted,
  onChangeCycle,
}: {
  colleges: SavedCollege[]
  onToggleSubmitted: (id: string) => void
  onChangeCycle: (id: string, cycle: ApplicationCycle) => void
}) {
  const t = useT()
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-primary">{t('submit.list.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('submit.list.subtitle')}</p>
        </div>
      </div>

      {colleges.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('submit.list.empty')}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_90px_110px_110px] gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
            <span>{t('submit.list.colSchool')}</span>
            <span>{t('submit.list.colPortal')}</span>
            <span>{t('submit.list.colCycle')}</span>
            <span>{t('submit.list.colDeadline')}</span>
            <span className="text-right">{t('submit.list.colSubmitted')}</span>
          </div>
          <div className="divide-y">
            {colleges.map((college, index) => {
              const portal = resolvePortal(college.name)
              const cycle = college.cycle || 'RD'
              return (
                <div
                  key={college.id}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  className="grid grid-cols-[1fr_120px_90px_110px_110px] gap-2 px-4 py-3 items-center animate-fade-in-up motion-reduce:animate-none"
                >
                  <span className="text-sm font-medium text-primary truncate">{college.name}</span>
                  <span>
                    <span
                      className={cn(
                        'rounded-full text-xs px-2 py-0.5',
                        portal === 'commonApp'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {t(PORTAL_LABEL_KEY[portal])}
                    </span>
                  </span>
                  <Select value={cycle} onValueChange={(value) => onChangeCycle(college.id, value as ApplicationCycle)}>
                    <SelectTrigger className="w-auto h-auto gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100">
                      {cycle}
                    </SelectTrigger>
                    <SelectContent align="start">
                      {CYCLES.map((option) => (
                        <SelectItem key={option} value={option} className="text-xs">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {college.deadline
                      ? new Date(college.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </span>
                  <button
                    onClick={() => onToggleSubmitted(college.id)}
                    className={cn(
                      'justify-self-end flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95',
                      college.submitted
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                        : 'hover:bg-muted',
                    )}
                  >
                    {college.submitted && <Check className="h-3 w-3" />}
                    {college.submitted ? t('submit.list.submitted') : t('submit.list.markSubmitted')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
