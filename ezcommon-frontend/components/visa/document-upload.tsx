"use client"
import { useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'
import type { RequiredDocumentKey, VisaDocFile } from '@/lib/visa-prep-store'

/**
 * Attach the actual document to a checklist row.
 *
 * Ticking "I have my I-20" and holding the I-20 are different states, and only
 * one of them survives the walk to the consulate. The checklist could already
 * record the first; this records the second.
 *
 * Everything lands in the `visa` upload section, which is kept apart from the
 * application sections on purpose - someone at this stage already has their
 * I-20 and is not applying to anywhere any more.
 */
export function VisaDocumentUpload({
  userId,
  docKey,
  files,
  onUploaded,
  onRemove,
}: {
  userId: string
  docKey: RequiredDocumentKey
  files: VisaDocFile[]
  onUploaded: (files: VisaDocFile[]) => void
  onRemove: (filename: string) => void
}) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('user_id', userId)
      // The document type is carried in the filename so the stored object is
      // self-describing - a bare "scan.pdf" in a bucket tells nobody whether
      // it is a passport or a bank statement.
      for (const file of Array.from(list)) {
        form.append('files', file, `${docKey}__${file.name}`)
      }
      const res = await fetch(`${base}/api/upload/visa`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || t('visaPrep.upload.failed'))
      const added: VisaDocFile[] = (data.uploaded_files || data.files || []).map((f: any) => ({
        filename: String(f.filename || '').replace(`${docKey}__`, ''),
        size: Number(f.size || 0),
        url: f.url,
        uploadedAt: new Date().toISOString(),
      }))
      onUploaded(added.length ? added : Array.from(list).map((f) => ({
        filename: f.name,
        size: f.size,
        uploadedAt: new Date().toISOString(),
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('visaPrep.upload.failed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-accent/60 hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          {files.length ? t('visaPrep.upload.addMore') : t('visaPrep.upload.attach')}
        </button>

        {files.map((f) => (
          <span
            key={f.filename}
            className="inline-flex max-w-[16rem] items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] text-primary"
          >
            {f.url ? (
              <a href={f.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                {f.filename}
              </a>
            ) : (
              <span className="truncate">{f.filename}</span>
            )}
            <button
              type="button"
              onClick={() => onRemove(f.filename)}
              aria-label={t('visaPrep.upload.remove')}
              className="shrink-0 text-muted-foreground/70 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
        className="hidden"
        onChange={(e) => send(e.target.files)}
      />
    </div>
  )
}
