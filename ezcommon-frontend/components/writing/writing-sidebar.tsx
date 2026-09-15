"use client"
import { useMemo, useState } from 'react'
import { Check, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESSAY_TASKS, essayTaskTitle, type EssayTask } from '@/lib/essay-tasks'
import type { EssayStore } from '@/lib/essay-store'
import { wordCount } from '@/lib/essay-store'
import { useT } from '@/lib/i18n/use-t'

/**
 * Supplemental tasks are titled "School - Prompt" so they read correctly in the
 * flat lists elsewhere. Under a school's own heading that prefix is the school
 * name twice, so it is trimmed for display only - search still matches the full
 * title, which is what makes typing a school name keep its group.
 */
function essayLabel(full: string, school: string): string {
  for (const sep of [' \u00b7 ', ' - ', ': ']) {
    const head = school + sep
    if (full.startsWith(head)) return full.slice(head.length)
  }
  return full
}

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
  const t = useT()
  const [query, setQuery] = useState('')
  /**
   * Which schools the student has opened by hand. Everything else is closed.
   *
   * Listing every essay for every school at once turned the sidebar into a
   * wall - a student with eight schools had thirty rows to scroll past to
   * reach the one they were writing. One row per school, opened on demand,
   * with the counts still visible so nothing is hidden, only folded.
   */
  const [opened, setOpened] = useState<Record<string, boolean>>({})

  const mainTasks = useMemo(
    () => ESSAY_TASKS.filter((task) => essayTaskTitle(task, t).toLowerCase().includes(query.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h2 className="font-semibold text-primary mb-3">{t('writing.sidebar.title')}</h2>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('writing.sidebar.searchPlaceholder')}
            className="w-full rounded-lg border bg-card pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('writing.sidebar.mainEssays')}</p>
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
                  <span className="truncate">{essayTaskTitle(task, t)}</span>
                </span>
              </button>
            )
          })}
        </div>

        {schoolTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('writing.sidebar.noSchools')}</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('writing.sidebar.targetColleges')}</p>
            <div className="space-y-1">
              {Array.from(schoolsByName.entries()).map(([school, tasks]) => {
                const doneCount = tasks.filter((task) => essays[task.id] && wordCount(essays[task.id].html) > 0).length
                const matching = tasks.filter((task) =>
                  essayTaskTitle(task, t).toLowerCase().includes(query.toLowerCase()),
                )
                // Open if the student opened it, if they are writing one of
                // these, or if a search matched inside - a folded match is a
                // search that looks like it found nothing.
                const holdsActive = tasks.some((task) => task.id === activeId)
                const isOpen = opened[school] ?? (holdsActive || (!!query && matching.length > 0))
                if (query && matching.length === 0) return null
                const allDone = doneCount === tasks.length && tasks.length > 0

                return (
                  <div key={school}>
                    <button
                      type="button"
                      onClick={() => setOpened((prev) => ({ ...prev, [school]: !isOpen }))}
                      aria-expanded={isOpen}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                        holdsActive ? 'text-primary' : 'text-primary hover:bg-muted',
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
                          isOpen && 'rotate-90',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{school}</span>
                      <span
                        className={cn(
                          'shrink-0 text-xs tabular-nums',
                          allDone ? 'text-emerald-600' : 'text-muted-foreground',
                        )}
                      >
                        {doneCount}/{tasks.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mb-2 space-y-1 pl-6">
                        {matching.map((task) => {
                          const record = essays[task.id]
                          const done = record && wordCount(record.html) > 0
                          const isActive = task.id === activeId
                          return (
                            <button
                              key={task.id}
                              onClick={() => onSelect(task.id)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs',
                                isActive
                                  ? 'bg-secondary font-medium text-primary'
                                  : 'text-muted-foreground hover:bg-muted',
                              )}
                            >
                              {done && <Check className="h-3 w-3 shrink-0 text-emerald-500" />}
                              <span className="truncate">{essayLabel(essayTaskTitle(task, t), school)}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
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
