import { ChevronRight } from 'lucide-react'
import type { EssayTask } from '@/lib/essay-tasks'
import type { EssayStore } from '@/lib/essay-store'
import { wordCount } from '@/lib/essay-store'

function statusFor(task: EssayTask, essays: EssayStore) {
  const record = essays[task.id]
  const words = record ? wordCount(record.html) : 0
  if (words === 0) return { label: 'Not started', detail: `Nothing written yet — start a draft.` }
  if (words < task.wordLimit * 0.9) return { label: 'Draft in progress', detail: `Keep going.` }
  return { label: 'Ready to review', detail: `Close to the word limit.` }
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
  const others = tasks.filter((t) => t.id !== activeId)
  const recommended = others.find((t) => !essays[t.id] || wordCount(essays[t.id].html) === 0) || others[0]
  const nextUp = others.find((t) => t.id !== recommended?.id) || others[1]

  const cards = [
    { label: 'Recommended', task: recommended },
    { label: 'Next up', task: nextUp },
  ].filter((c) => c.task)

  if (cards.length === 0) return null

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Across all your essays</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map(({ label, task }) => {
          if (!task) return null
          const status = statusFor(task, essays)
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
              <p className="font-medium text-primary mt-1">{task.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{status.detail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Draft · {status.label.toLowerCase()} · {words}/{task.wordLimit} words
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
