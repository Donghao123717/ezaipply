"use client"
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ESSAY_TASKS, ESSAY_PROMPTS, essayTaskTitle, getSchoolEssayTasks } from '@/lib/essay-tasks'
import { loadEssays, saveEssay, loadProfileContext, wordCount, type EssayStore } from '@/lib/essay-store'
import { loadColleges } from '@/lib/college-store'
import { WritingSidebar } from '@/components/writing/writing-sidebar'
import { EssayEditor } from '@/components/writing/essay-editor'
import { EssayCoachPanel } from '@/components/writing/essay-coach-panel'
import { EssayEvaluation } from '@/components/writing/essay-evaluation'
import { AcrossEssays } from '@/components/writing/across-essays'
import { useT } from '@/lib/i18n/use-t'

export function WritingWorkspace({ userId }: { userId: string }) {
  const t = useT()
  const [activeId, setActiveId] = useState(ESSAY_TASKS[0].id)
  const [essays, setEssays] = useState<EssayStore>({})
  const [schoolTasks, setSchoolTasks] = useState(() => getSchoolEssayTasks([], t))
  const [promptId, setPromptId] = useState<string>('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const allTasks = useMemo(() => [...ESSAY_TASKS, ...schoolTasks], [schoolTasks])
  const task = allTasks.find((task) => task.id === activeId) || allTasks[0]
  const record = essays[activeId]
  const html = record?.html || ''

  useEffect(() => {
    setEssays(loadEssays(userId))
    setSchoolTasks(getSchoolEssayTasks(loadColleges(userId), t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    setPromptId(essays[activeId]?.promptId || '')
    setDraftError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  function persist(nextHtml: string, nextPromptId: string | null) {
    const updated = { html: nextHtml, promptId: nextPromptId, updatedAt: new Date().toISOString() }
    setEssays((prev) => ({ ...prev, [activeId]: updated }))
    saveEssay(userId, activeId, updated)
  }

  const prompt = ESSAY_PROMPTS.find((p) => p.id === promptId)?.text || task.prompt || ''

  async function startDraft() {
    setDrafting(true)
    setDraftError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          profile_context: loadProfileContext(userId),
          word_limit: task.wordLimit,
          essay_type: essayTaskTitle(task, t),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Draft failed')
      const paragraphs = String(data.draft)
        .split(/\n{2,}/)
        .map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
      persist(paragraphs, promptId || null)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <WritingSidebar activeId={activeId} onSelect={setActiveId} essays={essays} schoolTasks={schoolTasks} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-primary">{essayTaskTitle(task, t)}</h1>
              <p className="text-sm text-muted-foreground">{t('writing.wordsMax').replace('{count}', String(task.wordLimit))}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div>
              {task.promptRequired && (
                <div className="mb-4 flex items-center gap-3">
                  <select
                    value={promptId}
                    onChange={(e) => {
                      setPromptId(e.target.value)
                      persist(html, e.target.value || null)
                    }}
                    className="rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">{t('writing.pickPrompt')}</option>
                    {ESSAY_PROMPTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.text.slice(0, 60)}…
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground flex-1">
                    {prompt || t('writing.pickPromptHint')}
                  </p>
                </div>
              )}

              {task.prompt && (
                <div className="mb-4 rounded-lg border bg-secondary/30 px-4 py-3">
                  <p className="text-sm text-foreground">{task.prompt}</p>
                </div>
              )}

              <EssayEditor html={html} onChange={(next) => persist(next, promptId || null)} />
              {draftError && <p className="text-sm text-destructive mt-2">{draftError}</p>}

              <EssayEvaluation essayHtml={html} prompt={prompt} wordLimit={task.wordLimit} />

              <AcrossEssays tasks={allTasks} essays={essays} activeId={activeId} onSelect={setActiveId} />
            </div>

            <div className="lg:sticky lg:top-6 h-[600px]">
              <EssayCoachPanel
                hasDraft={wordCount(html) > 0}
                essayHtml={html}
                prompt={prompt}
                onStartDraft={startDraft}
                drafting={drafting}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
