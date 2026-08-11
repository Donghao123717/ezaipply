"use client"
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ESSAY_PROMPTS, essayTaskTitle, type EssayTask } from '@/lib/essay-tasks'
import { loadProfileContext, wordCount, type EssayRecord } from '@/lib/essay-store'
import { EssayEditor } from '@/components/writing/essay-editor'
import { useT } from '@/lib/i18n/use-t'

/**
 * Reuses the exact same essay editor and localStorage record (keyed by
 * `school-${collegeId}`, see lib/essay-tasks.ts + lib/essay-store.ts) that
 * the Writing page uses - editing here IS editing the same essay there.
 */
export function ApplicationWritingPage({
  userId,
  task,
  record,
  onChange,
}: {
  userId: string
  task: EssayTask
  record: EssayRecord | undefined
  onChange: (html: string) => void
}) {
  const t = useT()
  const [promptId, setPromptId] = useState(record?.promptId || '')
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const html = record?.html || ''
  const prompt = ESSAY_PROMPTS.find((p) => p.id === promptId)?.text || ''

  async function startDraft() {
    setDrafting(true)
    setError(null)
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
      onChange(paragraphs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">{essayTaskTitle(task, t)}</h2>
          <p className="text-xs text-muted-foreground">{t('writing.wordsMax').replace('{count}', String(task.wordLimit))}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/writing">{t('applicationForm.writingPage.openInWriting')}</Link>
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <select
          value={promptId}
          onChange={(e) => setPromptId(e.target.value)}
          className="rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">{t('writing.pickPrompt')}</option>
          {ESSAY_PROMPTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.text.slice(0, 60)}…
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground flex-1">{prompt || t('writing.pickPromptHint')}</p>
      </div>

      {wordCount(html) === 0 && (
        <div className="mb-4">
          <Button onClick={startDraft} disabled={drafting} size="sm">
            {drafting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                {t('writing.coach.drafting')}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                {t('writing.coach.startFirstDraft')}
              </>
            )}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      <EssayEditor html={html} onChange={onChange} />
    </div>
  )
}
