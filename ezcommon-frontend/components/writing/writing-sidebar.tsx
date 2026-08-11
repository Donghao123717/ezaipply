"use client"
import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESSAY_TASKS, type EssayTask } from '@/lib/essay-tasks'
import type { EssayStore } from '@/lib/essay-store'
import { wordCount } from '@/lib/essay-store'

export function WritingSidebar({
  activeId,
  onSelect,
  essays,
  schoolTasks,
}: {
  activeId: string
  onSelect: (id: string) => void
  essays: EssayStore
  schoolTasks: EssayTask[]
}) {
  const [query, setQuery] = useState('')

  const mainTasks = useMemo(
    () => ESSAY_TASKS.filter((t) => t.group === 'main' && t.title.toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  const schoolsByName = useMemo(() => {
    const grouped = new Map<string, EssayTask[]>()
    for (const task of schoolTasks) {
      const key = task.school || 'Other'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(task)
    }
    return grouped
  }, [schoolTasks])

  return (
    <aside className="w-72 shrink-0 border-r bg-card/50 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="font-semibold text-primary mb-3">Writing Tasks</h2>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search school, prompt, or essay title"
            className="w-full rounded-lg border bg-card pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Main Essays</p>
        <div className="space-y-1 mb-4">
          {mainTasks.map((task) => {
            const record = essays[task.id]
            const done = record && wordCount(record.html) > 0
            const isActive = task.id === activeId
            return (
              <button
                key={task.id}
                onClick={() => onSelect(task.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left',
                  isActive ? 'bg-secondary text-primary font-medium' : 'hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {done && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  <span className="truncate">{task.title}</span>
                </span>
              </button>
            )
          })}
        </div>

        {schoolTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No target colleges yet. Add schools on the Colleges page to unlock their supplemental essays here.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Target Colleges</p>
            <div className="space-y-1">
              {Array.from(schoolsByName.entries()).map(([school, tasks]) => {
            const doneCount = tasks.filter((t) => essays[t.id] && wordCount(essays[t.id].html) > 0).length
            return (
              <div key={school}>
                <div className="px-3 py-2 flex items-center justify-between text-sm font-medium text-primary">
                  <span className="truncate">{school}</span>
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{tasks.length}
                  </span>
                </div>
                <div className="pl-2 space-y-1 mb-2">
                  {tasks
                    .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
                    .map((task) => {
                      const record = essays[task.id]
                      const done = record && wordCount(record.html) > 0
                      const isActive = task.id === activeId
                      return (
                        <button
                          key={task.id}
                          onClick={() => onSelect(task.id)}
                          className={cn(
                            'w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-left',
                            isActive ? 'bg-secondary text-primary font-medium' : 'hover:bg-muted text-muted-foreground',
                          )}
                        >
                          {done && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
                          <span className="truncate">{task.title}</span>
                        </button>
                      )
                    })}
                </div>
              </div>
            )
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
