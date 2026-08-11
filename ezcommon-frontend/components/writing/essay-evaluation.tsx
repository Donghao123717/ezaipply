"use client"
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

interface Evaluation {
  overall_score: number
  summary: string
  feedback: { category: string; comment: string }[]
  word_count: number
}

export function EssayEvaluation({
  essayHtml,
  prompt,
  wordLimit,
}: {
  essayHtml: string
  prompt: string
  wordLimit: number
}) {
  const t = useT()
  const [deepReview, setDeepReview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Evaluation | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essay_content: essayHtml,
          prompt,
          word_limit: wordLimit,
          deep_review: deepReview,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Evaluation failed')
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-primary">{t('writing.evaluation.title')}</h3>
          <button
            onClick={() => setDeepReview((v) => !v)}
            className="text-xs text-muted-foreground mt-0.5 hover:text-foreground"
          >
            {deepReview ? t('writing.evaluation.deepReviewOn') : t('writing.evaluation.deepReviewOff')}
          </button>
        </div>
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              {t('writing.evaluation.reviewing')}
            </>
          ) : (
            t('writing.evaluation.runEvaluation')
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      {result && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-4 mb-3">
            <div
              className={cn(
                'h-14 w-14 rounded-full border-4 flex items-center justify-center text-lg font-semibold shrink-0',
                result.overall_score >= 75
                  ? 'border-emerald-500 text-emerald-600'
                  : result.overall_score >= 50
                    ? 'border-amber-500 text-amber-600'
                    : 'border-destructive text-destructive',
              )}
            >
              {result.overall_score}
            </div>
            <div>
              <p className="text-sm text-foreground">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('writing.evaluation.words').replace('{count}', String(result.word_count))}</p>
            </div>
          </div>
          <div className="space-y-2">
            {result.feedback.map((item, i) => (
              <div key={i} className="rounded-lg bg-muted/60 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">{item.category}</span>
                <p className="text-sm text-foreground mt-0.5">{item.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
