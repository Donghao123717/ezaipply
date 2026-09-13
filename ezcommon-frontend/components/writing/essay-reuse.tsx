"use client"
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, Recycle, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { essayTaskTitle, type EssayTask } from '@/lib/essay-tasks'
import { saveEssay, wordCount, type EssayStore } from '@/lib/essay-store'
import {
  loadEssayMatches,
  saveEssayMatches,
  type EssayMatch,
  type EssayMatchSet,
} from '@/lib/essay-matches-store'

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreTone(score: number) {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700' }
  return { bar: 'bg-amber-500', text: 'text-amber-700' }
}

export function EssayReuse({
  userId,
  tasks,
  essays,
  onSelect,
  onEssaysChanged,
}: {
  userId: string
  tasks: EssayTask[]
  essays: EssayStore
  onSelect: (taskId: string) => void
  onEssaysChanged: () => void
}) {
  const t = useT()
  const [set, setSet] = useState<EssayMatchSet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adapting, setAdapting] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setSet(loadEssayMatches(userId))
    // Render the bars at 0 first so the width transition has something to run
    // from. A timeout rather than requestAnimationFrame: rAF never fires while
    // the tab isn't compositing, which would leave the bars stuck at zero.
    const id = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(id)
  }, [userId])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const written = useMemo(
    () => tasks.filter((task) => wordCount(essays[task.id]?.html || '') >= 50),
    [tasks, essays],
  )
  const unwritten = useMemo(
    () => tasks.filter((task) => wordCount(essays[task.id]?.html || '') === 0),
    [tasks, essays],
  )

  // A match stops being useful once its target has been written.
  const liveMatches = useMemo(
    () =>
      (set?.matches || []).filter(
        (m) => wordCount(essays[m.targetTaskId]?.html || '') === 0 && taskById.has(m.targetTaskId),
      ),
    [set, essays, taskById],
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, EssayMatch[]>()
    for (const match of liveMatches) {
      const list = groups.get(match.sourceTaskId) || []
      list.push(match)
      groups.set(match.sourceTaskId, list)
    }
    return groups
  }, [liveMatches])

  const nextUpTask = set?.nextUp ? taskById.get(set.nextUp.taskId) : undefined
  const nextUpStillOpen = nextUpTask && wordCount(essays[nextUpTask.id]?.html || '') === 0

  async function findMatches() {
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/reuse-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          written: written.map((task) => ({
            task_id: task.id,
            title: essayTaskTitle(task, t),
            prompt: task.prompt || '',
            text: plainText(essays[task.id]?.html || ''),
            word_count: wordCount(essays[task.id]?.html || ''),
          })),
          targets: unwritten.map((task) => ({
            task_id: task.id,
            title: essayTaskTitle(task, t),
            school: task.school || '',
            prompt: task.prompt || '',
            word_limit: task.wordLimit,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const next: EssayMatchSet = {
        generatedAt: new Date().toISOString(),
        matches: (data.matches || []).map((m: any) => ({
          sourceTaskId: m.source_task_id,
          targetTaskId: m.target_task_id,
          score: m.score,
          reason: m.reason,
        })),
        nextUp: data.next_up
          ? { taskId: data.next_up.task_id, reason: data.next_up.reason, unlocks: data.next_up.unlocks }
          : null,
      }
      setSet(next)
      saveEssayMatches(userId, next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('writing.reuse.error'))
    } finally {
      setLoading(false)
    }
  }

  async function adapt(match: EssayMatch) {
    const source = taskById.get(match.sourceTaskId)
    const target = taskById.get(match.targetTaskId)
    if (!source || !target) return
    setAdapting(match.targetTaskId)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: plainText(essays[source.id]?.html || ''),
          source_prompt: source.prompt || '',
          target_prompt: target.prompt || essayTaskTitle(target, t),
          target_school: target.school || '',
          word_limit: target.wordLimit,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const html = String(data.draft)
        .split(/\n{2,}/)
        .map((p: string) => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
        .join('')
      saveEssay(userId, target.id, { html, promptId: null, updatedAt: new Date().toISOString() })
      onEssaysChanged()
      onSelect(target.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('writing.reuse.error'))
    } finally {
      setAdapting(null)
    }
  }

  if (written.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed bg-card/50 px-5 py-6 text-center">
        <Recycle className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-primary">{t('writing.reuse.emptyTitle')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('writing.reuse.emptyBody')}</p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b">
        <div>
          <h3 className="font-semibold text-primary text-sm flex items-center gap-2">
            <Recycle className="h-4 w-4 text-accent" />
            {t('writing.reuse.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {liveMatches.length > 0
              ? t('writing.reuse.summary')
                  .replace('{matches}', String(liveMatches.length))
                  .replace('{targets}', String(new Set(liveMatches.map((m) => m.targetTaskId)).size))
              : t('writing.reuse.subtitle')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={findMatches} disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {set ? t('writing.reuse.refresh') : t('writing.reuse.find')}
        </Button>
      </div>

      {error && <p className="px-5 py-3 text-sm text-destructive">{error}</p>}

      {set && nextUpStillOpen && nextUpTask && (
        <div className="mx-5 mt-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 animate-fade-in-up motion-reduce:animate-none">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            {t('writing.reuse.nextUpLabel')}
          </p>
          <p className="text-sm font-medium text-primary mt-1">{essayTaskTitle(nextUpTask, t)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {set.nextUp!.unlocks > 0
              ? t('writing.reuse.unlocks').replace('{count}', String(set.nextUp!.unlocks))
              : set.nextUp!.reason}
          </p>
          <button
            type="button"
            onClick={() => onSelect(nextUpTask.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:gap-1.5 transition-all"
          >
            {t('writing.reuse.goWrite')}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {set && liveMatches.length === 0 && !loading && (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">{t('writing.reuse.noMatches')}</p>
      )}

      {Array.from(grouped.entries()).map(([sourceId, matches], groupIndex) => {
        const source = taskById.get(sourceId)
        if (!source) return null
        return (
          <div key={sourceId} className="px-5 py-4 border-t first:border-t-0">
            <p className="text-xs text-muted-foreground mb-2.5">
              {t('writing.reuse.fromEssay')}{' '}
              <button
                type="button"
                onClick={() => onSelect(sourceId)}
                className="font-medium text-primary hover:underline"
              >
                {essayTaskTitle(source, t)}
              </button>
            </p>
            <ul className="space-y-2">
              {matches.map((match, index) => {
                const target = taskById.get(match.targetTaskId)!
                const tone = scoreTone(match.score)
                const isAdapting = adapting === match.targetTaskId
                return (
                  <li
                    key={match.targetTaskId}
                    style={{ animationDelay: `${Math.min(groupIndex * 3 + index, 8) * 45}ms` }}
                    className="rounded-lg border bg-background px-3.5 py-2.5 animate-fade-in-up motion-reduce:animate-none hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelect(match.targetTaskId)}
                          className="text-sm font-medium text-primary truncate block hover:underline text-left"
                        >
                          {essayTaskTitle(target, t)}
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5">{match.reason}</p>
                      </div>
                      <div className="shrink-0 w-20 text-right">
                        <p className={cn('text-sm font-semibold tabular-nums', tone.text)}>{match.score}%</p>
                        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-[width] duration-700 ease-out', tone.bar)}
                            style={{ width: mounted ? `${match.score}%` : '0%' }}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={isAdapting}
                        onClick={() => adapt(match)}
                      >
                        {isAdapting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                            {t('writing.reuse.adapt')}
                          </>
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
