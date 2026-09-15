"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Award, Briefcase, FileText, GraduationCap, Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'
import { apiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

interface ProfileDoc {
  filename: string
  size: number
  section: string
  s3_key: string
  url?: string
}

/**
 * The four kinds of paperwork a student actually hands over, each in its own
 * folder.
 *
 * One undifferentiated pile meant a student who had uploaded a transcript, two
 * recommendation drafts, an internship letter and four award certificates had
 * to read nine filenames to check whether the award was there. Filing them on
 * the way in costs one click and makes "do I have my transcript?" answerable at
 * a glance.
 *
 * `sections` is what the bucket accepts on upload (the first entry) and what it
 * collects on display - `grades` sweeps up the starter flow's `testing` uploads
 * alongside transcripts, because from the student's side both are "my scores".
 */
type BucketKey = 'personal' | 'grades' | 'experience' | 'awards'

const BUCKETS: { key: BucketKey; sections: string[]; icon: LucideIcon }[] = [
  { key: 'personal', sections: ['profile'], icon: FileText },
  { key: 'grades', sections: ['education', 'testing'], icon: GraduationCap },
  { key: 'experience', sections: ['activity'], icon: Briefcase },
  { key: 'awards', sections: ['honor'], icon: Award },
]

// Visa paperwork lives on the visa side and is deliberately not shown here: a
// student at that stage already has their I-20, and mixing the two sets is the
// exact confusion the separate upload section exists to prevent.
const HIDDEN_SECTIONS = new Set(['visa'])

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FilesPanel({
  userId,
  onClose,
  onCountChange,
}: {
  userId: string
  onClose: () => void
  onCountChange?: (count: number) => void
}) {
  const t = useT()
  const [files, setFiles] = useState<ProfileDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<BucketKey | null>(null)
  const [dragOver, setDragOver] = useState<BucketKey | null>(null)
  const [error, setError] = useState('')
  const inputs = useRef<Partial<Record<BucketKey, HTMLInputElement | null>>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/user/${encodeURIComponent(userId)}`)
      const data = await res.json()
      const list: ProfileDoc[] = (data.files || []).filter((f: ProfileDoc) => !HIDDEN_SECTIONS.has(f.section))
      setFiles(list)
      onCountChange?.(list.length)
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
    // onCountChange is a setState from the parent and stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const byBucket = useMemo(() => {
    const map = new Map<BucketKey, ProfileDoc[]>(BUCKETS.map((b) => [b.key, []]))
    // Anything filed under a section no bucket claims still belongs to the
    // student, so it is shown with their personal documents rather than
    // silently dropped.
    for (const file of files) {
      const bucket = BUCKETS.find((b) => b.sections.includes(file.section))
      map.get(bucket?.key || 'personal')!.push(file)
    }
    return map
  }, [files])

  async function upload(bucket: BucketKey, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(bucket)
    setError('')
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const section = BUCKETS.find((b) => b.key === bucket)!.sections[0]
      const form = new FormData()
      form.append('user_id', userId)
      Array.from(fileList).forEach((f) => form.append('files', f))
      const res = await fetch(`${base}/api/upload/${section}`, { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(apiErrorMessage(body, t('profile.files.uploadFailed')))
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.files.uploadFailed'))
    } finally {
      setUploading(null)
    }
  }

  async function remove(f: ProfileDoc) {
    const next = files.filter((x) => x.s3_key !== f.s3_key)
    setFiles(next)
    onCountChange?.(next.length)
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    await fetch(`${base}/api/upload/file?s3_key=${encodeURIComponent(f.s3_key)}&user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto border-l bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-primary">
              <Paperclip className="h-4 w-4 text-accent" />
              {t('profile.files.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('profile.files.subtitle')}</p>
          </div>
          <button onClick={onClose} aria-label={t('profile.suggestions.close')}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('profile.files.loading')}</p>
          ) : (
            BUCKETS.map(({ key, icon: Icon }) => {
              const items = byBucket.get(key) || []
              const busy = uploading === key
              return (
                <section key={key} className="rounded-xl border bg-background/40">
                  <div className="flex items-center gap-2 px-4 pt-3.5">
                    <Icon className="h-4 w-4 shrink-0 text-accent" />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
                      {t(`profile.files.buckets.${key}.label`)}
                    </h3>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                  </div>
                  <p className="px-4 pt-1 text-xs text-muted-foreground">
                    {t(`profile.files.buckets.${key}.hint`)}
                  </p>

                  <div className="space-y-1 px-2 pb-2 pt-2">
                    {items.map((f) => (
                      <div
                        key={f.s3_key}
                        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate hover:underline"
                          title={f.filename}
                        >
                          {f.filename}
                        </a>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.size)}</span>
                        <button
                          onClick={() => remove(f)}
                          aria-label={t('profile.files.remove').replace('{filename}', f.filename)}
                          className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => inputs.current[key]?.click()}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(key)
                      }}
                      onDragLeave={() => setDragOver((prev) => (prev === key ? null : prev))}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(null)
                        upload(key, e.dataTransfer.files)
                      }}
                      className={cn(
                        'flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors',
                        dragOver === key
                          ? 'border-primary bg-secondary/50 text-primary'
                          : 'text-muted-foreground hover:border-primary hover:text-primary',
                      )}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {busy ? t('profile.files.uploading') : t('profile.files.addTo')}
                    </button>
                    <input
                      ref={(el) => {
                        inputs.current[key] = el
                      }}
                      type="file"
                      multiple
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        upload(key, e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </section>
              )
            })
          )}

          {!loading && files.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">{t('profile.files.empty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
