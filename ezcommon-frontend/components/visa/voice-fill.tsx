"use client"
import { useRef, useState } from 'react'
import { Check, Loader2, Mic, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldDef } from '@/lib/profile-schema'
import { fieldLabel } from '@/lib/profile-schema'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api-error'

/**
 * Speak a DS-160 page instead of typing it.
 *
 * Only offered on the pages the profile cannot prefill - trip dates, where you
 * are staying, who is receiving you, prior visits. Those are short factual
 * answers spread over a dozen boxes, which is exactly where talking beats
 * typing. Everywhere else the answer is either already known or too
 * consequential to dictate.
 *
 * Nothing is written from the recording directly: values come back as a
 * proposal the applicant accepts or discards, because this is a sworn form and
 * a transcription slip is not a typo.
 */
export function VoiceFill({
  fields,
  sectionLabel,
  onApply,
}: {
  fields: FieldDef[]
  sectionLabel: string
  onApply: (values: Record<string, string>) => void
}) {
  const t = useT()
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const byKey = new Map(fields.map((f) => [f.key, f]))

  async function start() {
    setError(null)
    setValues(null)
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        await send(new Blob(chunks, { type: 'audio/webm' }))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(t('ds160.voice.micDenied'))
    }
  }

  function stop() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop()
      setRecording(false)
    }
  }

  async function send(blob: Blob) {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('audio', blob, 'answer.webm')
      form.append('section_label', sectionLabel)
      form.append(
        'fields_json',
        JSON.stringify(
          fields.map((f) => ({
            key: f.key,
            label: fieldLabel(f, t),
            type: f.type,
            options: f.options || [],
          })),
        ),
      )
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/voice-fill`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, t('ds160.voice.failed')))
      setTranscript(data.transcript || '')
      setValues(data.values || {})
      if (!Object.keys(data.values || {}).length) setError(t('ds160.voice.nothingCaught'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ds160.voice.failed'))
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (values) onApply(values)
    setValues(null)
    setTranscript('')
  }

  const caught = values ? Object.entries(values) : []

  return (
    <div className="mb-6 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">{t('ds160.voice.title')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('ds160.voice.hint')}</p>
        </div>
        <Button
          size="sm"
          variant={recording ? 'destructive' : 'outline'}
          onClick={recording ? stop : start}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : recording ? (
            <Square className="mr-1.5 h-3 w-3 fill-current" />
          ) : (
            <Mic className="mr-1.5 h-3.5 w-3.5" />
          )}
          {busy ? t('ds160.voice.working') : recording ? t('ds160.voice.stop') : t('ds160.voice.start')}
        </Button>
      </div>

      {recording && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" />
          {t('ds160.voice.listening')}
        </p>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {transcript && (
        <p className="mt-3 rounded-lg bg-card px-3 py-2 text-xs italic text-muted-foreground">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {/* A proposal, not a write. They confirm before it touches the form. */}
      {caught.length > 0 && (
        <div className="mt-3 rounded-lg border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-primary">
            {t('ds160.voice.caught').replace('{n}', String(caught.length))}
          </p>
          <dl className="space-y-1.5">
            {caught.map(([key, value]) => {
              const field = byKey.get(key)
              return (
                <div key={key} className="flex gap-2 text-xs">
                  <dt className="w-40 shrink-0 text-muted-foreground">
                    {field ? fieldLabel(field, t) : key}
                  </dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              )
            })}
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={apply}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {t('ds160.voice.apply')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setValues(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Pages where speaking helps. Everything else is either prefilled from the
 * profile or too consequential to dictate - the security questions above all,
 * where a misheard word changes a sworn answer.
 */
export const VOICE_SECTIONS = ['travel', 'companions', 'previousTravel', 'usContact', 'addressPhone']

export function sectionAcceptsVoice(key: string): boolean {
  return VOICE_SECTIONS.includes(key)
}
