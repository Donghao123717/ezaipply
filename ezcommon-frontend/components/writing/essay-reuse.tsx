"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, FileUp, Loader2, Recycle, Sparkles, Trash2, Wand2, X } from 'lucide-react'
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
import {
  addImportedSource,
  isImportedId,
  loadImportedSources,
  removeImportedSource,
  type ImportedSource,
} from '@/lib/essay-sources-store'
import {
  dropPreview,
  loadPreviews,
  putPreview,
  type PreviewMap,
} from '@/lib/essay-previews-store'
import { apiErrorMessage } from '@/lib/api-error'

/** How many adaptations to run at once - enough to feel fast, not enough to rate-limit. */
const EXPAND_CONCURRENCY = 3

type RowStatus = 'idle' | 'queued' | 'drafting' | 'ready'

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toHtml(draft: string): string {
  return draft
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
    .join('')
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
  const [imported, setImported] = useState<ImportedSource[]>([])
  const [previews, setPreviews] = useState<PreviewMap>({})
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [openPreview, setOpenPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSet(loadEssayMatches(userId))
    setImported(loadImportedSources(userId))
    setPreviews(loadPreviews(userId))
    const id = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(id)
  }, [userId])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const importedById = useMemo(() => new Map(imported.map((s) => [s.id, s])), [imported])

  /** Anything long enough to adapt from: finished tasks plus imported files. */
  const writtenTasks = useMemo(
    () => tasks.filter((task) => wordCount(essays[task.id]?.html || '') >= 50),
    [tasks, essays],
  )
  const hasSources = writtenTasks.length > 0 || imported.length > 0

  const unwritten = useMemo(
    () => tasks.filter((task) => wordCount(essays[task.id]?.html || '') === 0),
    [tasks, essays],
  )

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

  const pendingCount = liveMatches.filter((m) => !previews[m.targetTaskId]).length
  const readyCount = liveMatches.filter((m) => previews[m.targetTaskId]).length

  function sourceTitle(sourceId: string): string {
    if (isImportedId(sourceId)) return importedById.get(sourceId)?.title || t('writing.reuse.importedSource')
    const task = taskById.get(sourceId)
    return task ? essayTaskTitle(task, t) : sourceId
  }

  function sourceText(sourceId: string): string {
    if (isImportedId(sourceId)) return importedById.get(sourceId)?.text || ''
    return plainText(essays[sourceId]?.html || '')
  }

  async function importFile(file: File) {
    setImporting(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${base}/api/essay/import`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Import failed'))
      setImported(
        addImportedSource(userId, {
          title: file.name.replace(/\.[^.]+$/, ''),
          text: data.text,
          wordCount: data.word_count,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : t('writing.reuse.error'))
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function findMatches() {
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const written = [
        ...writtenTasks.map((task) => ({
          task_id: task.id,
          title: essayTaskTitle(task, t),
          prompt: task.prompt || '',
          text: plainText(essays[task.id]?.html || ''),
          word_count: wordCount(essays[task.id]?.html || ''),
        })),
        ...imported.map((s) => ({
          task_id: s.id,
          title: s.title,
          prompt: '',
          text: s.text,
          word_count: s.wordCount,
        })),
      ]
      const res = await fetch(`${base}/api/essay/reuse-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          written,
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
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Request failed'))
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

  /** Generates one adaptation into the preview store - never into the task itself. */
  async function draftPreview(match: EssayMatch) {
    const target = taskById.get(match.targetTaskId)
    const text = sourceText(match.sourceTaskId)
    if (!target || !text) return
    setStatuses((prev) => ({ ...prev, [match.targetTaskId]: 'drafting' }))
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: text,
          source_prompt: isImportedId(match.sourceTaskId)
            ? ''
            : taskById.get(match.sourceTaskId)?.prompt || '',
          target_prompt: target.prompt || essayTaskTitle(target, t),
          target_school: target.school || '',
          word_limit: target.wordLimit,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Request failed'))
      setPreviews(
        putPreview(userId, {
          targetTaskId: target.id,
          sourceId: match.sourceTaskId,
          html: toHtml(String(data.draft)),
          changes: String(data.changes || ''),
          createdAt: new Date().toISOString(),
        }),
      )
      setStatuses((prev) => ({ ...prev, [match.targetTaskId]: 'ready' }))
    } catch (e) {
      setStatuses((prev) => ({ ...prev, [match.targetTaskId]: 'idle' }))
      setError(e instanceof Error ? e.message : t('writing.reuse.error'))
    }
  }

  /** Expands every match that has no preview yet, a few at a time. */
  async function expandAll() {
    const todo = liveMatches.filter((m) => !previews[m.targetTaskId])
    if (todo.length === 0) return
    setExpanding(true)
    setError(null)
    setStatuses(Object.fromEntries(todo.map((m) => [m.targetTaskId, 'queued' as RowStatus])))

    const queue = [...todo]
    const workers = Array.from({ length: Math.min(EXPAND_CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const match = queue.shift()
        if (match) await draftPreview(match)
      }
    })
    await Promise.all(workers)
    setExpanding(false)
  }

  function acceptPreview(targetTaskId: string) {
    const preview = previews[targetTaskId]
    if (!preview) return
    saveEssay(userId, targetTaskId, {
      html: preview.html,
      promptId: null,
      updatedAt: new Date().toISOString(),
    })
    setPreviews(dropPreview(userId, targetTaskId))
    setOpenPreview(null)
    onEssaysChanged()
    onSelect(targetTaskId)
  }

  function discardPreview(targetTaskId: string) {
    setPreviews(dropPreview(userId, targetTaskId))
    setStatuses((prev) => ({ ...prev, [targetTaskId]: 'idle' }))
    setOpenPreview(null)
  }

  const nextUpTask = set?.nextUp ? taskById.get(set.nextUp.taskId) : undefined
  const nextUpStillOpen = nextUpTask && wordCount(essays[nextUpTask.id]?.html || '') === 0

  const importRow = (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) importFile(file)
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileUp className="h-3.5 w-3.5 mr-1.5" />
        )}
        {t('writing.reuse.import')}
      </Button>
      {imported.map((source) => (
        <span
          key={source.id}
          className="group inline-flex items-center gap-1.5 rounded-full border bg-muted/50 pl-2.5 pr-1.5 py-1 text-xs animate-fade-in-up motion-reduce:animate-none"
        >
          <span className="text-foreground max-w-[160px] truncate">{source.title}</span>
          <span className="text-muted-foreground tabular-nums">{source.wordCount}</span>
          <button
            type="button"
            onClick={() => setImported(removeImportedSource(userId, source.id))}
            aria-label={t('writing.reuse.removeImport')}
            className="rounded p-0.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )

  if (!hasSources) {
    return (
      <div className="mt-6 rounded-xl border border-dashed bg-card/50 px-5 py-6 text-center">
        <Recycle className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-primary">{t('writing.reuse.emptyTitle')}</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">{t('writing.reuse.emptyBody')}</p>
        <div className="flex justify-center">{importRow}</div>
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      </div>
    )
  }

  const preview = openPreview ? previews[openPreview] : null
  const previewTask = openPreview ? taskById.get(openPreview) : null

  return (
    <div className="mt-6 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b flex-wrap">
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
        <div className="flex items-center gap-2">
          {liveMatches.length > 0 && pendingCount > 0 && (
            <Button size="sm" onClick={expandAll} disabled={expanding}>
              {expanding ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('writing.reuse.expandAll').replace('{count}', String(pendingCount))}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={findMatches} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {set ? t('writing.reuse.refresh') : t('writing.reuse.find')}
          </Button>
        </div>
      </div>

      <div className="px-5 py-3 border-b bg-muted/20">{importRow}</div>

      {error && <p className="px-5 py-3 text-sm text-destructive">{error}</p>}

      {readyCount > 0 && (
        <p className="px-5 pt-3 text-xs text-muted-foreground">
          {t('writing.reuse.awaitingReview').replace('{count}', String(readyCount))}
        </p>
      )}

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

      {Array.from(grouped.entries()).map(([sourceId, matches], groupIndex) => (
        <div key={sourceId} className="px-5 py-4 border-t">
          <p className="text-xs text-muted-foreground mb-2.5">
            {t('writing.reuse.fromEssay')}{' '}
            <button
              type="button"
              onClick={() => (isImportedId(sourceId) ? undefined : onSelect(sourceId))}
              className={cn('font-medium text-primary', !isImportedId(sourceId) && 'hover:underline')}
            >
              {sourceTitle(sourceId)}
            </button>
          </p>
          <ul className="space-y-2">
            {matches.map((match, index) => {
              const target = taskById.get(match.targetTaskId)!
              const tone = scoreTone(match.score)
              const hasPreview = Boolean(previews[match.targetTaskId])
              const status: RowStatus = hasPreview ? 'ready' : statuses[match.targetTaskId] || 'idle'
              return (
                <li
                  key={match.targetTaskId}
                  style={{ animationDelay: `${Math.min(groupIndex * 3 + index, 8) * 45}ms` }}
                  className={cn(
                    'rounded-lg border px-3.5 py-2.5 animate-fade-in-up motion-reduce:animate-none transition-colors',
                    hasPreview ? 'border-emerald-300 bg-emerald-50/40' : 'bg-background hover:border-primary/30',
                  )}
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
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {status === 'queued'
                          ? t('writing.reuse.statusQueued')
                          : status === 'drafting'
                            ? t('writing.reuse.statusDrafting')
                            : match.reason}
                      </p>
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
                    {status === 'ready' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setOpenPreview(match.targetTaskId)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        {t('writing.reuse.review')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={status === 'drafting' || status === 'queued'}
                        onClick={() => draftPreview(match)}
                      >
                        {status === 'drafting' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                            {t('writing.reuse.adapt')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {preview && previewTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in-up motion-reduce:animate-none"
          onClick={() => setOpenPreview(null)}
        >
          <div
            className="bg-card rounded-xl border shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {t('writing.reuse.previewLabel')}
                </p>
                <h4 className="font-semibold text-primary truncate">{essayTaskTitle(previewTask, t)}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('writing.reuse.previewFrom').replace('{source}', sourceTitle(preview.sourceId))}
                  {' · '}
                  {t('writing.reuse.previewWords')
                    .replace('{words}', String(wordCount(preview.html)))
                    .replace('{limit}', String(previewTask.wordLimit))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPreview(null)}
                aria-label={t('common.close')}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview.changes && (
              <p className="px-5 py-2.5 text-xs text-muted-foreground bg-muted/40 border-b">{preview.changes}</p>
            )}

            <div
              className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed space-y-3 [&>p]:mb-3"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground">{t('writing.reuse.previewHint')}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => discardPreview(preview.targetTaskId)}>
                  {t('writing.reuse.discard')}
                </Button>
                <Button size="sm" onClick={() => acceptPreview(preview.targetTaskId)}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {t('writing.reuse.accept')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
