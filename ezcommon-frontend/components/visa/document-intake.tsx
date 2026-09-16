"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, FileText, Loader2, Paperclip, Sparkles, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { apiErrorMessage } from '@/lib/api-error'
import { documentsFor, displayName, kindOf, storedName, type VisaDocKind } from '@/lib/visa-documents'
import { importDocument } from '@/lib/visa-document-import'
import type { VisaType } from '@/lib/visa-chat-store'

/**
 * The paperwork, collected by what it is.
 *
 * Every document here either fills part of the DS-160 or is one the applicant
 * has to carry to the window, and the card says which. That matters more than
 * it sounds: a passport answers eight of the form's fields and half of Personal
 * Information, so an applicant who uploads one should never be asked their
 * passport number - and the only way they trust that is to watch it happen.
 *
 * What each visa class needs on top of the shared set differs enough that
 * asking a B1/B2 applicant for an I-20, or a student for an H-1B approval
 * notice, is the kind of thing that makes people abandon a form.
 */

interface StoredDoc {
  stored: string
  name: string
  size: number
  url?: string
}

export function DocumentIntake({
  userId,
  visaType,
  onFilled,
}: {
  userId: string
  visaType: VisaType
  /** Told what a document put into the form, so the page above can say so. */
  onFilled?: (filled: { label: string; value: string }[]) => void
}) {
  const t = useT()
  const specs = documentsFor(visaType)
  const [files, setFiles] = useState<Record<string, StoredDoc[]>>({})
  const [busy, setBusy] = useState<VisaDocKind | null>(null)
  const [reading, setReading] = useState<VisaDocKind | null>(null)
  const [results, setResults] = useState<Record<string, { label: string; value: string }[]>>({})
  const [error, setError] = useState('')
  const inputs = useRef<Partial<Record<VisaDocKind, HTMLInputElement | null>>>({})

  const refresh = useCallback(async () => {
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/visa?user_id=${encodeURIComponent(userId)}`)
      const data = await res.json()
      const grouped: Record<string, StoredDoc[]> = {}
      for (const f of data.files || []) {
        const stored = String(f.filename || '')
        const kind = kindOf(stored)
        if (!kind) continue
        grouped[kind] = grouped[kind] || []
        grouped[kind].push({ stored, name: displayName(stored), size: Number(f.size || 0), url: f.url })
      }
      setFiles(grouped)
    } catch {
      // Nothing listed is the same as nothing uploaded, as far as this view goes.
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function upload(kind: VisaDocKind, list: FileList | null) {
    if (!list?.length) return
    setBusy(kind)
    setError('')
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('user_id', userId)
      for (const file of Array.from(list)) form.append('files', file, storedName(kind, file.name))
      const res = await fetch(`${base}/api/upload/visa`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(data, t('visaDocs.uploadFailed')))
      await refresh()

      // Read it straight away. A document that sits in a bucket unread is the
      // same as one that was never uploaded, as far as the form is concerned.
      const uploaded = (data.files || data.uploaded_files || [])[0]?.filename
      const spec = specs.find((s) => s.kind === kind)
      if (uploaded && spec?.extracts) {
        setReading(kind)
        try {
          const filled = await importDocument(userId, kind, uploaded, t)
          setResults((prev) => ({ ...prev, [kind]: filled }))
          if (filled.length) onFilled?.(filled)
        } catch (e) {
          setError(e instanceof Error ? e.message : t('visaDocs.readFailed'))
        } finally {
          setReading(null)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('visaDocs.uploadFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function remove(kind: VisaDocKind, doc: StoredDoc) {
    setFiles((prev) => ({ ...prev, [kind]: (prev[kind] || []).filter((d) => d.stored !== doc.stored) }))
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    // The list endpoint does not hand back the key, so it is rebuilt the way
    // the upload service composes it.
    await fetch(
      `${base}/api/upload/file?s3_key=${encodeURIComponent(`user-uploads/${userId}/visa/${doc.stored}`)}&user_id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ).catch(() => undefined)
  }

  const held = specs.filter((s) => (files[s.kind] || []).length > 0).length
  const needed = specs.filter((s) => s.required).length
  const heldRequired = specs.filter((s) => s.required && (files[s.kind] || []).length > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-semibold text-primary">{t('visaDocs.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('visaDocs.subtitle')}</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('visaDocs.progress')
            .replace('{held}', String(heldRequired))
            .replace('{needed}', String(needed))}
        </span>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {specs.map((spec) => {
          const mine = files[spec.kind] || []
          const filled = results[spec.kind]
          const isBusy = busy === spec.kind
          const isReading = reading === spec.kind
          return (
            <section
              key={spec.kind}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                mine.length ? 'border-emerald-200/70 bg-emerald-50/30' : 'bg-card',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    mine.length ? 'border-emerald-200 bg-white text-emerald-600' : 'bg-background text-muted-foreground',
                  )}
                >
                  {mine.length ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {t(spec.labelKey)}
                    {spec.required && <span className="text-destructive">*</span>}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(spec.hintKey)}</p>
                </div>
              </div>

              {mine.length > 0 && (
                <div className="mt-3 space-y-1">
                  {mine.map((doc) => (
                    <div key={doc.stored} className="group flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5 text-xs">
                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate hover:underline"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                      <button
                        onClick={() => remove(spec.kind, doc)}
                        aria-label={t('common.remove')}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* What this document put into the form. Shown per field, because
                  "we read your passport" is not something anyone can check. */}
              {isReading ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('visaDocs.reading')}
                </p>
              ) : filled ? (
                filled.length ? (
                  <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-2.5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                      <Sparkles className="h-3 w-3 text-accent" />
                      {t('visaDocs.filled').replace('{count}', String(filled.length))}
                    </p>
                    <ul className="space-y-0.5">
                      {filled.slice(0, 6).map((entry) => (
                        <li key={entry.label} className="truncate text-[11px] text-muted-foreground">
                          <span className="text-primary">{entry.label}</span>
                          <span className="mx-1 opacity-50">→</span>
                          {entry.value}
                        </li>
                      ))}
                      {filled.length > 6 && (
                        <li className="text-[11px] text-muted-foreground">
                          {t('visaDocs.andMore').replace('{count}', String(filled.length - 6))}
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{t('visaDocs.nothingRead')}</p>
                )
              ) : null}

              <button
                type="button"
                disabled={isBusy}
                onClick={() => inputs.current[spec.kind]?.click()}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {isBusy ? t('visaDocs.uploading') : mine.length ? t('visaDocs.addAnother') : t('visaDocs.add')}
              </button>
              <input
                ref={(el) => {
                  inputs.current[spec.kind] = el
                }}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  upload(spec.kind, e.target.files)
                  e.target.value = ''
                }}
              />
            </section>
          )
        })}
      </div>
    </div>
  )
}
