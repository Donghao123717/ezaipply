"use client"
import { useState } from 'react'
import { Calendar, Check, Zap } from 'lucide-react'
import type { CollegeCategory } from '@/lib/college-store'
import { STATUS_LABEL, type ApplicationProgress } from '@/lib/application-status'
import { cn } from '@/lib/utils'

const CATEGORY_LABEL: Record<CollegeCategory, string> = { reach: 'Reach', target: 'Target', safety: 'Safety' }

export function FormHeader({
  schoolName,
  category,
  deadline,
  onSetDeadline,
  progress,
  saved,
}: {
  schoolName: string
  category: CollegeCategory
  deadline: string | null
  onSetDeadline: (date: string) => void
  progress: ApplicationProgress
  saved: boolean
}) {
  const [editingDeadline, setEditingDeadline] = useState(false)

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Application Form</p>
          <h1 className="font-display text-3xl font-semibold">{schoolName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="flex items-center gap-1 rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium">
              <Zap className="h-3 w-3" />
              {CATEGORY_LABEL[category]}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  progress.status === 'complete' ? 'bg-emerald-400' : 'bg-sky-400',
                )}
              />
              {STATUS_LABEL[progress.status]}
            </span>
            {editingDeadline ? (
              <input
                type="date"
                autoFocus
                defaultValue={deadline || ''}
                onBlur={(e) => {
                  if (e.target.value) onSetDeadline(e.target.value)
                  setEditingDeadline(false)
                }}
                className="rounded-full border border-white/30 bg-transparent px-2.5 py-1 text-xs text-primary-foreground [color-scheme:dark]"
              />
            ) : (
              <button
                onClick={() => setEditingDeadline(true)}
                className="flex items-center gap-1 rounded-full border border-white/30 px-2.5 py-1 text-xs font-medium hover:bg-white/10"
              >
                <Calendar className="h-3 w-3" />
                {deadline ? new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Set deadline'}
              </button>
            )}
            {saved && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs font-medium">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/20 bg-white/5 p-4 w-full lg:w-64 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Form Progress</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-xs text-white/80">
              {progress.requiredAnswered} of {progress.requiredTotal} required answered
            </p>
            <p className="text-xl font-semibold">{progress.percent}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mt-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
              {Math.max(progress.requiredTotal - progress.requiredAnswered, 0)} required left
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{progress.optionalTotal} optional</span>
          </div>
        </div>
      </div>
    </div>
  )
}
