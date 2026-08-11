"use client"
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SavedCollege } from '@/lib/college-store'
import { PORTAL_LABEL } from '@/lib/college-store'
import { useT } from '@/lib/i18n/use-t'

export function ApplicationsList({
  colleges,
  onToggleSubmitted,
}: {
  colleges: SavedCollege[]
  onToggleSubmitted: (id: string) => void
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
          <div className="grid grid-cols-[1fr_100px_70px_110px_110px] gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
            <span>{t('submit.list.colSchool')}</span>
            <span>{t('submit.list.colPortal')}</span>
            <span>{t('submit.list.colCycle')}</span>
            <span>{t('submit.list.colDeadline')}</span>
            <span className="text-right">{t('submit.list.colSubmitted')}</span>
          </div>
          <div className="divide-y">
            {colleges.map((college) => (
              <div key={college.id} className="grid grid-cols-[1fr_100px_70px_110px_110px] gap-2 px-4 py-3 items-center">
                <span className="text-sm font-medium text-primary truncate">{college.name}</span>
                <span>
                  <span className="rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-0.5">{PORTAL_LABEL}</span>
                </span>
                <span className="text-xs text-muted-foreground">RD</span>
                <span className="text-xs text-muted-foreground">
                  {college.deadline ? new Date(college.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </span>
                <button
                  onClick={() => onToggleSubmitted(college.id)}
                  className={cn(
                    'justify-self-end flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    college.submitted
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : 'hover:bg-muted',
                  )}
                >
                  {college.submitted && <Check className="h-3 w-3" />}
                  {college.submitted ? t('submit.list.submitted') : t('submit.list.markSubmitted')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
