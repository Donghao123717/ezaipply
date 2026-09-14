"use client"
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Mic, RotateCcw, Send, Languages, Square, Video, VideoOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { loadDS160Context } from '@/lib/ds160-store'
import { loadProfileContext } from '@/lib/essay-store'
import {
  loadInterview,
  saveInterview,
  clearInterview,
  averageScore,
  type InterviewSession,
  type InterviewTurn,
  type ConsistencyFlag,
} from '@/lib/visa-interview-store'
import type { VisaType } from '@/lib/visa-chat-store'
import {
  mediaSupported,
  requestMedia,
  stopStream,
  speak,
  stopSpeaking,
  createRecorder,
  type MediaPermission,
} from '@/lib/interview-media'
import { cn } from '@/lib/utils'

/**
 * A mock consular interview: one question at a time, the way a real one runs.
 *
 * The questions themselves are the easy part. What this does that a chat box
 * cannot is check each spoken answer against the applicant's own DS-160 - a
 * contradiction between the two is one of the most ordinary ways a routine
 * interview becomes a refusal, and the applicant has no way to spot it because
 * they filled the form weeks earlier.
 */

const SEVERITY_STYLE: Record<ConsistencyFlag['severity'], string> = {
  high: 'border-destructive/50 bg-destructive/10 text-destructive',
  medium: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  low: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

export function MockInterview({ userId, visaType }: { userId: string; visaType: VisaType }) {
  const t = useT()
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [pending, setPending] = useState<string>('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTranslation, setShowTranslation] = useState(true)
  const [pendingTranslation, setPendingTranslation] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Spoken mode: camera on, question read aloud, answer spoken.
  const [permission, setPermission] = useState<MediaPermission>('idle')
  // Resolved after mount: mediaSupported() reads navigator, which does not
  // exist during server rendering, so using it directly in render made the
  // server and client disagree and React threw a hydration error.
  const [canUseMedia, setCanUseMedia] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setCanUseMedia(mediaSupported())
  }, [])

  // Leaving a camera or mic live after the interview is a light that stays on.
  useEffect(() => {
    return () => {
      stopStream(streamRef.current)
      streamRef.current = null
      stopSpeaking()
    }
  }, [])

  // Read each new question aloud, once, the way it arrives on the day.
  useEffect(() => {
    if (pending && permission === 'granted') speak(pending)
  }, [pending, permission])

  async function enableMedia(withVideo: boolean) {
    setPermission('prompting')
    try {
      const stream = await requestMedia(withVideo)
      stopStream(streamRef.current)
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(withVideo)
      setPermission('granted')
    } catch (err) {
      setPermission(err instanceof Error && err.message === 'unsupported' ? 'unsupported' : 'denied')
    }
  }

  function toggleRecording() {
    if (!streamRef.current) return
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
    stopSpeaking()
    const recorder = createRecorder(streamRef.current, async (blob) => {
      setTranscribing(true)
      try {
        const form = new FormData()
        form.append('audio', blob, 'answer.webm')
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
        const res = await fetch(`${base}/api/visa/transcribe-answer`, { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.detail || t('visaInterview.transcribeFailed'))
        // Into the box rather than straight off to be graded - a
        // mis-transcribed answer should be correctable before it counts.
        setAnswer((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript))
      } catch (e) {
        setError(e instanceof Error ? e.message : t('visaInterview.transcribeFailed'))
      } finally {
        setTranscribing(false)
      }
    })
    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  useEffect(() => {
    const existing = loadInterview(userId)
    setSession(existing)
    // Resume on the question they had not answered yet.
    const open = existing?.turns.find((turn) => !turn.answer)
    if (open) {
      setPending(open.question)
      setPendingTranslation(open.questionTranslation || '')
    }
  }, [userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [session, pending])

  async function callInterview(turns: InterviewTurn[]) {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    const res = await fetch(`${base}/api/visa/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visa_type: visaType,
        turns: turns.map((turn) => ({ question: turn.question, answer: turn.answer })),
        ds160_context: loadDS160Context(userId),
        profile_context: loadProfileContext(userId),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.detail || t('visaInterview.failed'))
    return data
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const data = await callInterview([])
      const fresh: InterviewSession = {
        visaType,
        turns: [],
        startedAt: new Date().toISOString(),
        done: false,
      }
      setSession(fresh)
      saveInterview(userId, fresh)
      setPending(data.question)
      setPendingTranslation(data.question_translation || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('visaInterview.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!answer.trim() || busy || !session) return
    setBusy(true)
    setError(null)
    const answered: InterviewTurn[] = [
      ...session.turns,
      { question: pending, questionTranslation: pendingTranslation, answer: answer.trim() },
    ]
    setAnswer('')
    try {
      const data = await callInterview(answered)
      // The reply grades the answer we just sent, then asks the next question.
      const graded = [...answered]
      graded[graded.length - 1] = {
        ...graded[graded.length - 1],
        evaluation: data.evaluation ?? undefined,
        score: typeof data.score === 'number' ? data.score : undefined,
        betterAnswer: data.better_answer ?? undefined,
        consistency: (data.consistency || []).map((f: any) => ({
          severity: f.severity,
          said: f.said,
          formSays: f.form_says,
          detail: f.detail,
        })),
      }
      const next: InterviewSession = { ...session, turns: graded, done: !!data.done }
      setSession(next)
      saveInterview(userId, next)
      setPending(data.done ? '' : data.question)
      setPendingTranslation(data.done ? '' : data.question_translation || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('visaInterview.failed'))
      // Put their answer back so a failed round trip does not eat it.
      setAnswer(answered[answered.length - 1].answer)
      setSession(session)
    } finally {
      setBusy(false)
    }
  }

  function restart() {
    clearInterview(userId)
    setSession(null)
    setPending('')
    setPendingTranslation('')
    setAnswer('')
    setError(null)
  }

  const avg = averageScore(session)
  const flagCount = (session?.turns || []).reduce((n, turn) => n + (turn.consistency?.length || 0), 0)

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-primary">{t('visaInterview.title')}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('visaInterview.intro')}</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground/80">{t('visaInterview.consistencyNote')}</p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button className="mt-6" onClick={start} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('visaInterview.start')}
        </Button>

        {/* The camera and mic prompt only ever comes from a button. A dialog
            nobody asked for gets dismissed, and a dismissal is a denial the
            browser remembers. */}
        {canUseMedia ? (
          permission !== 'granted' && (
            <div className="mt-6 max-w-md rounded-xl border border-dashed p-4">
              <p className="text-sm font-medium text-primary">{t('visaInterview.spokenTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('visaInterview.spokenBlurb')}</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => enableMedia(true)} disabled={permission === 'prompting'}>
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  {t('visaInterview.enableVideo')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => enableMedia(false)} disabled={permission === 'prompting'}>
                  <Mic className="mr-1.5 h-3.5 w-3.5" />
                  {t('visaInterview.enableAudioOnly')}
                </Button>
              </div>
              {permission === 'denied' && (
                <p className="mt-2 text-xs text-destructive">{t('visaInterview.permissionDenied')}</p>
              )}
            </div>
          )
        ) : (
          <p className="mt-6 max-w-md text-xs text-muted-foreground">{t('visaInterview.mediaUnsupported')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-primary">{t('visaInterview.title')}</span>
          <span className="text-muted-foreground">
            {t('visaInterview.turnCount').replace('{n}', String(session.turns.length))}
          </span>
          {avg !== null && (
            <span className="text-muted-foreground">
              {t('visaInterview.avgScore').replace('{n}', String(avg))}
            </span>
          )}
          {flagCount > 0 && (
            <span className="flex items-center gap-1 font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('visaInterview.flagCount').replace('{n}', String(flagCount))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Also reachable mid-interview: a session resumed from last time
              never passes the start screen, and that used to be the only place
              spoken mode could be switched on. */}
          {permission !== 'granted' && canUseMedia && (
            <button
              type="button"
              onClick={() => enableMedia(true)}
              disabled={permission === 'prompting'}
              title={permission === 'denied' ? t('visaInterview.permissionDenied') : undefined}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                permission === 'denied'
                  ? 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'border-accent/50 bg-accent/10 text-primary hover:bg-accent/20',
              )}
            >
              {permission === 'denied' ? <VideoOff className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {permission === 'denied' ? t('visaInterview.permissionBlocked') : t('visaInterview.enableVideo')}
            </button>
          )}
          {permission === 'granted' && pending && (
            <button
              type="button"
              onClick={() => speak(pending)}
              aria-label={t('visaInterview.replay')}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <Volume2 className="h-3 w-3" />
              {t('visaInterview.replay')}
            </button>
          )}
          {permission === 'granted' && (
            <button
              type="button"
              onClick={() => enableMedia(!cameraOn)}
              aria-pressed={cameraOn}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {cameraOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
              {t('visaInterview.camera')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            aria-pressed={showTranslation}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <Languages className="h-3 w-3" />
            {t('visaInterview.toggleTranslation')}
          </button>
          <Button size="sm" variant="outline" onClick={restart}>
            <RotateCcw className="mr-1.5 h-3 w-3" />
            {t('visaInterview.restart')}
          </Button>
        </div>
      </div>

      {/* Self-view. Half of what makes a consular window hard is being looked
          at while you answer, and you cannot rehearse that against a text box. */}
      {permission === 'granted' && cameraOn && (
        <div className="pointer-events-none absolute bottom-28 right-6 z-10">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-32 w-44 rounded-lg border-2 border-primary/20 object-cover shadow-lg"
          />
        </div>
      )}

      <div ref={scrollRef} className="mx-auto w-full max-w-3xl flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {session.turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('visaInterview.officer')}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">{turn.question}</p>
              {showTranslation && turn.questionTranslation && (
                <p className="mt-0.5 text-xs text-muted-foreground">{turn.questionTranslation}</p>
              )}
            </div>

            <div className="rounded-lg bg-muted px-4 py-2.5">
              <p className="text-sm whitespace-pre-wrap">{turn.answer}</p>
            </div>

            {turn.evaluation && (
              <div className="rounded-lg border-l-2 border-accent bg-accent/5 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {t('visaInterview.feedback')}
                  </p>
                  {typeof turn.score === 'number' && (
                    <span className="text-xs tabular-nums text-muted-foreground">{turn.score}/100</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{turn.evaluation}</p>
                {turn.betterAnswer && (
                  <div className="mt-3 rounded-md bg-card px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {t('visaInterview.sayItLikeThis')}
                    </p>
                    <p className="mt-0.5 text-sm text-primary">{turn.betterAnswer}</p>
                  </div>
                )}
              </div>
            )}

            {/* The part a chat box cannot do: what they said against what they wrote. */}
            {(turn.consistency || []).map((flag, fi) => (
              <div
                key={fi}
                style={{ animationDelay: `${fi * 80}ms` }}
                className={cn(
                  'animate-fade-in-up rounded-lg border px-4 py-3 motion-reduce:animate-none',
                  SEVERITY_STYLE[flag.severity],
                )}
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('visaInterview.contradiction')}
                </p>
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium">{t('visaInterview.youSaid')}</dt>
                    <dd>{flag.said}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium">{t('visaInterview.formSays')}</dt>
                    <dd>{flag.formSays}</dd>
                  </div>
                </dl>
                {flag.detail && <p className="mt-2 text-xs opacity-90">{flag.detail}</p>}
              </div>
            ))}
          </div>
        ))}

        {pending && (
          <div key={pending} className="animate-fade-in-up motion-reduce:animate-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t('visaInterview.officer')}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">{pending}</p>
            {showTranslation && pendingTranslation && (
              <p className="mt-0.5 text-xs text-muted-foreground">{pendingTranslation}</p>
            )}
          </div>
        )}

        {session.done && !pending && (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium text-primary">{t('visaInterview.doneTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('visaInterview.doneBody')}</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={restart}>
              <RotateCcw className="mr-1.5 h-3 w-3" />
              {t('visaInterview.restart')}
            </Button>
          </div>
        )}
      </div>

      {!session.done && (
        <div className="border-t px-6 py-4">
          {error && <p className="mx-auto mb-2 max-w-3xl text-sm text-destructive">{error}</p>}
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            {permission === 'granted' && (
              <Button
                type="button"
                variant={recording ? 'destructive' : 'outline'}
                onClick={toggleRecording}
                disabled={transcribing || busy}
                aria-label={recording ? t('visaInterview.stopAnswer') : t('visaInterview.speakAnswer')}
                title={recording ? t('visaInterview.stopAnswer') : t('visaInterview.speakAnswer')}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : recording ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={2}
              placeholder={t('visaInterview.answerPlaceholder')}
              className="flex-1 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button onClick={submit} disabled={busy || !answer.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted-foreground">
            {recording
              ? t('visaInterview.recordingHint')
              : permission === 'granted'
                ? t('visaInterview.spokenHint')
                : t('visaInterview.answerHint')}
          </p>
        </div>
      )}
    </div>
  )
}
