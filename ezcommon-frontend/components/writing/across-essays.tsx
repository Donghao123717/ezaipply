"use client"
import { ChevronRight } from 'lucide-react'
import type { EssayTask } from '@/lib/essay-tasks'
import { essayTaskTitle } from '@/lib/essay-tasks'
import type { EssayStore } from '@/lib/essay-store'
import { wordCount } from '@/lib/essay-store'
import { useT } from '@/lib/i18n/use-t'

function statusFor(task: EssayTask, essays: EssayStore, t: (key: string) => string) {
  const record = essays[task.id]
  const words = record ? wordCount(record.html) : 0
  if (words === 0) return { label: t('common.status.notStarted'), detail: t('writing.across.notStartedDetail') }
  if (words < task.wordLimit * 0.9) return { label: t('writing.across.inProgress'), detail: t('writing.across.inProgressDetail') }
  return { label: t('writing.across.readyToReview'), detail: t('writing.across.readyToReviewDetail') }
}

export function AcrossEssays({
  tasks,
  essays,
  activeId,
  onSelect,
}: {
  tasks: EssayTask[]
  essays: EssayStore
  activeId: string
  onSelect: (id: string) => void
}) {
  const t = useT()
  const others = tasks.filter((task) => task.id !== activeId)
  const recommended = others.find((task) => !essays[task.id] || wordCount(essays[task.id].html) === 0) || others[0]
  const nextUp = others.find((task) => task.id !== recommended?.id) || others[1]

  const cards = [
    { label: t('writing.across.recommended'), task: recommended },
    { label: t('writing.across.nextUp'), task: nextUp },
  ].filter((c) => c.task)

  if (cards.length === 0) return null

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t('writing.across.title')}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map(({ label, task }) => {
          if (!task) return null
          const status = statusFor(task, essays, t)
          const record = essays[task.id]
          const words = record ? wordCount(record.html) : 0
          return (
            <button
              key={task.id}
              onClick={() => onSelect(task.id)}
              className="text-left rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-medium text-primary mt-1">{essayTaskTitle(task, t)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{status.detail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('writing.across.draftLine')
                  .replace('{status}', status.label)
                  .replace('{words}', String(words))
                  .replace('{limit}', String(task.wordLimit))}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
