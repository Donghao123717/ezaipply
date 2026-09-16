"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2, MessageCircle, RotateCcw, Send, SkipForward, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { useLocale } from '@/lib/i18n/locale-context'
import { apiErrorMessage } from '@/lib/api-error'
import { loadDS160Data, saveDS160Data, type Ds160Data } from '@/lib/ds160-store'
import { findGaps, knownContext, nextBatch, type Gap } from '@/lib/ds160-gaps'
import { addInterviewNote } from '@/lib/visa-interview-notes'
import type { Ds160SectionMeta } from '@/lib/ds160-schema'
import type { VisaType } from '@/lib/visa-chat-store'
import { Button } from '@/components/ui/button'

/**
 * The DS-160, filled by talking.
 *
 * The form is two hundred and thirty-one fields of government English, and the
 * honest reason people pay someone to do this is that reading it is the hard
 * part. So the questions come one at a time, in words a person would actually
 * use, and the answers land in the form as they are given.
 *
 * What it deliberately is not is a chatbot that owns the form. The form stays
 * on screen beside the conversation and stays editable, because this is signed
 * under penalty of perjury and nobody should be asked to swear to something
 * they can only scroll back through a chat log to check. The conversation
 * fills; the form is still the record.
 */

interface Turn {
  role: 'assistant' | 'user'
  text: string
  /** What this turn wrote into the form, shown so nothing lands invisibly. */
  filled?: { label: string; value: string }[]
  hint?: string
}

function storageKey(userId: string) {
  return `aipply-ds160-chat-${userId}`
}

export function Ds160Conversation({
  userId,
  visaType,
  sections,
  onDataChange,
  onOpenForm,
  onReview,
}: {
  userId: string
  visaType: VisaType
  /** The pages that apply to this visa type, so we never ask about hidden ones. */
  sections: Ds160SectionMeta[]
  onDataChange: (data: Ds160Data) => void
  onOpenForm: (section: string) => void
  /** Everything answered - send them to read it before they sign it. */
  onReview: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<Gap[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])
  /**
   * Fields asked once that produced nothing - "I don't have my passport on
   * me", "I haven't booked anything yet". They are set aside rather than
   * dropped: the rest of the page gets finished, then they are asked once
   * more, that time asking what is in the way. Without remembering they were
   * asked at all, they stayed gaps and came round again immediately, which is
   * the loop that made the conversation feel broken.
   */
  const [deferred, setDeferred] = useState<Set<string>>(new Set())
  /** Pages whose set-aside questions have already been gone back over once. */
  const [swept, setSwept] = useState<Set<string>>(new Set())
  const [started, setStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const recount = useCallback(
    (_ruledOut?: Set<string>) => {
      const data = loadDS160Data(userId)
      const found = findGaps(data, t, sections)
      setGaps(found)
      return { data, found }
    },
    [userId, t, sections],
  )

  // Restoring the transcript happens once per applicant, and deliberately does
  // not depend on `recount`. It used to: `recount` changes identity whenever
  // the answers or the ruled-out set change, so every turn re-ran this and
  // pasted the transcript from before that turn back over the fresh one. The
  // visible symptom was the conversation cycling - the same two questions
  // asked over and over, because the record of having asked them kept being
  // rolled back.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userId))
      if (raw) {
        const saved = JSON.parse(raw)
        if (Array.isArray(saved?.turns)) setTurns(saved.turns)
        if (Array.isArray(saved?.pending)) setPending(saved.pending)
        if (Array.isArray(saved?.deferred)) setDeferred(new Set(saved.deferred))
        if (Array.isArray(saved?.swept)) setSwept(new Set(saved.swept))
        if (saved?.turns?.length) setStarted(true)
      }
    } catch {
      // A malformed transcript is not worth failing over - start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    recount()
  }, [recount])

  useEffect(() => {
    if (!started) return
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ turns, pending, deferred: [...deferred], swept: [...swept] }),
    )
  }, [turns, pending, deferred, swept, started, userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  async function turn(answer: string, answered: Gap[]) {
    setBusy(true)
    setError('')
    try {
      const { data, found } = recount()
      // The batch to ask about next is chosen here, not by the model.
      const remaining = found.filter(
        (g) => !answered.some((a) => a.section === g.section && a.field === g.field),
      )
      const next = nextBatch(remaining, 8, deferred, swept)
      const batch = next.gaps
      if (next.sweep && next.section) setSwept((prev) => new Set(prev).add(next.section))
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/ds160-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visa_type: visaType,
          locale,
          asked: answered.length ? turns.filter((x) => x.role === 'assistant').at(-1)?.text || '' : '',
          answer,
          answered_targets: answered,
          next_targets: batch,
          // The second time of asking is a different question: not "what is
          // it?" but "what is stopping you answering?"
          mode: next.sweep ? 'sweep' : 'ask',
          known_context: knownContext(data, t),
          remaining: remaining.length,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, t('ds160.chat.failed')))

      // Write what it understood into the form, and say so.
      const filled: { label: string; value: string }[] = []
      if (Array.isArray(body.fills) && body.fills.length) {
        const next: Ds160Data = { ...data }
        for (const fill of body.fills) {
          const sectionData = { ...((next[fill.section] as Record<string, any>) || {}) }
          sectionData[fill.field] = fill.value
          next[fill.section] = sectionData
          const target = [...answered, ...batch].find(
            (a) => a.section === fill.section && a.field === fill.field,
          )
          filled.push({ label: target?.label || fill.field, value: fill.value })
        }
        saveDS160Data(userId, next)
        onDataChange(next)
      }

      // Anything the officer will push on goes to the interviewer, written at
      // the moment the answer is given.
      if (body.interview_note) {
        addInterviewNote(userId, body.interview_note, answered[0]?.section || next.section)
      }

      setTurns((prev) => [
        ...prev,
        ...(filled.length ? [{ role: 'user' as const, text: '', filled }] : []),
        ...(body.question ? [{ role: 'assistant' as const, text: body.question, hint: body.hint }] : []),
      ])

      // They answered, and some of what was asked did not land. Unless this is
      // a follow-up - where the whole point is to ask those again - that means
      // the answer was "not applicable", and asking again is the bug.
      let setAside = deferred
      if (answer.trim() && !body.follow_up && answered.length) {
        const landed = new Set((body.fills || []).map((f: any) => `${f.section}.${f.field}`))
        setAside = new Set(deferred)
        for (const target of answered) {
          const id = `${target.section}.${target.field}`
          if (!landed.has(id)) setAside.add(id)
          else setAside.delete(id)
        }
        setDeferred(setAside)
      }

      // A follow-up is a re-ask of the same fields, so they stay pending.
      setPending(body.follow_up ? answered : batch)
      recount(setAside)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ds160.chat.failed'))
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function begin() {
    setStarted(true)
    void turn('', [])
  }

  function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setTurns((prev) => [...prev, { role: 'user', text }])
    void turn(text, pending)
  }

  function skip() {
    if (busy) return
    setTurns((prev) => [...prev, { role: 'user', text: t('ds160.chat.skipped') }])
    void turn(t('ds160.chat.skipAnswer'), [])
  }

  function restart() {
    window.localStorage.removeItem(storageKey(userId))
    setTurns([])
    setPending([])
    setDeferred(new Set())
    setSwept(new Set())
    setStarted(false)
    recount(new Set())
  }

  const total = Math.max(gaps.length + turns.filter((x) => x.filled?.length).length, 1)
  const done = turns.reduce((n, x) => n + (x.filled?.length || 0), 0)
  const finished = started && gaps.length === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-accent" />
          <h2 className="truncate font-semibold text-primary">{t('ds160.chat.title')}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('ds160.chat.remaining').replace('{count}', String(gaps.length))}
          </span>
          {started && (
            <button
              onClick={restart}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="h-3 w-3" />
              {t('ds160.chat.restart')}
            </button>
          )}
        </div>
      </div>

      {/* How much of the form the conversation has accounted for. */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {!started ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
              <Sparkles className="h-6 w-6 text-accent" />
            </span>
            <p className="mb-1.5 text-lg font-semibold text-primary">{t('ds160.chat.emptyTitle')}</p>
            <p className="mb-5 text-sm text-muted-foreground">
              {t('ds160.chat.emptyBody').replace('{count}', String(gaps.length))}
            </p>
            <Button onClick={begin} disabled={busy || gaps.length === 0}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('ds160.chat.begin')}
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            {turns.map((item, i) =>
              item.filled?.length ? (
                // The receipt for a turn: what went into the form, and where.
                <div key={i} className="ml-8 space-y-1">
                  {item.filled.map((entry) => (
                    <div
                      key={entry.label}
                      className="flex items-start gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-1.5 text-xs animate-fade-in-up motion-reduce:animate-none"
                    >
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                      <span className="text-emerald-900">
                        <span className="font-medium">{entry.label}</span>
                        <span className="mx-1.5 text-emerald-700/60">→</span>
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={i} className={item.role === 'user' ? 'ml-10' : 'mr-10'}>
                  <div
                    className={cn(
                      'animate-fade-in-up whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm motion-reduce:animate-none',
                      item.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-muted',
                    )}
                  >
                    {item.text}
                  </div>
                  {item.hint && (
                    <p className="ml-4 mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  )}
                </div>
              ),
            )}

            {busy && (
              <div className="mr-10 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('ds160.chat.thinking')}
              </div>
            )}

            {finished && !busy && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-center">
                <p className="mb-1 font-semibold text-primary">{t('ds160.chat.doneTitle')}</p>
                <p className="mb-3 text-sm text-muted-foreground">{t('ds160.chat.doneBody')}</p>
                <Button onClick={onReview}>
                  {t('ds160.chat.review')}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mx-5 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {started && !finished && (
        <div className="border-t px-5 py-3">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder={t('ds160.chat.placeholder')}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {/* Not every field applies to every applicant, and a form that will
                not move until you answer something that does not apply is how
                people give up on one. */}
            <button
              onClick={skip}
              disabled={busy}
              title={t('ds160.chat.skip')}
              aria-label={t('ds160.chat.skip')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label={t('common.send')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
