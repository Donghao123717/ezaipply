"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

/**
 * The file-upload step for one onboarding section.
 *
 * Replaces three components that differed only in the section slug, three
 * lines of copy and where they navigated afterwards. Activity keeps its own
 * component because it genuinely differs - it also records voice notes.
 */

export type UploadSection = 'profile' | 'education' | 'testing'

/** Where each step goes once its upload finishes or is skipped. */
const NEXT_HREF: Record<UploadSection, string> = {
  profile: '/starter/education/upload',
  education: '/starter/activity/upload',
  // The end of the flow is the student's dashboard. This used to push '/',
  // which is the public landing page - finishing onboarding bounced the
  // student back out to marketing.
  testing: '/home',
}

export function SectionUpload({ section }: { section: UploadSection }) {
  const t = useT()
  const router = useRouter()
  const { data: session, status } = useSession({ required: false })
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<{ filename: string; size: number; url?: string }[]>([])
  const [progress, setProgress] = useState(0)

  const nextHref = NEXT_HREF[section]

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const list = Array.from(e.dataTransfer.files || [])
    if (list.length) setFiles((prev) => [...prev, ...list])
  }, [])

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    if (list.length) setFiles((prev) => [...prev, ...list])
  }, [])

  const outline = useMemo(
    () => (dragOver ? 'border-primary bg-accent/40' : 'border-dashed border-muted-foreground/40'),
    [dragOver],
  )

  const handleSubmit = useCallback(async () => {
    setError(null)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      setError(t('starter.errors.noSession'))
      return
    }
    if (!files.length) {
      setError(t('starter.upload.pickOne'))
      return
    }
    setUploading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('user_id', userId)
      files.forEach((f) => form.append('files', f))
      // XHR rather than fetch, for upload progress.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${base}/api/upload/${section}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(t('starter.upload.failed')))
        }
        xhr.onerror = () => reject(new Error(t('starter.upload.networkError')))
        xhr.send(form)
      })
      router.push(nextHref)
    } catch (e: any) {
      setError(e?.message || t('starter.upload.failed'))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [session, files, router, section, nextHref, t])

  useEffect(() => {
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    fetch(`${base}/api/upload/${section}?user_id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => setExisting(data.files || []))
      .catch(() => {})
  }, [session, section])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('starter.upload.title')}</h1>
        <p className="text-sm text-muted-foreground">{t(`starter.upload.${section}.intro`)}</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-lg border ${outline} p-10 text-center transition-colors`}
      >
        <p className="mb-4 text-sm text-muted-foreground">{t(`starter.upload.${section}.hint`)}</p>
        <input
          aria-label={t(`starter.upload.${section}.inputLabel`)}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={onSelect}
          className="block cursor-pointer text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-3 w-full max-w-md text-left text-sm">
            {files.map((f) => (
              <li key={f.name} className="truncate">
                • {f.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {uploading && (
        <div
          className="h-2 w-full rounded bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-2 rounded bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button onClick={handleSubmit} className="w-full" disabled={uploading || status === 'loading'}>
          {uploading ? t('starter.upload.uploading') : t('starter.upload.submit')}
        </Button>
        <Link href={nextHref} className="text-center text-sm text-muted-foreground hover:underline">
          {t('starter.upload.skip')}
        </Link>
      </div>

      {existing.length > 0 && (
        <div className="mt-4 text-sm">
          <div className="mb-2 font-medium">{t('starter.upload.uploadedFiles')}</div>
          <ul className="list-disc space-y-1 pl-5">
            {existing.map((f) => (
              <li key={f.filename} className="truncate">
                {f.filename} <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
