"use client"
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Trash2, Download, FileText, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

/**
 * The upload-review screen for one onboarding section.
 *
 * This replaces four near-identical components - they differed only in the
 * section slug, two lines of copy and the link to the next step, and had
 * drifted: the education screen sent students straight to the dashboard,
 * skipping Activity and Testing entirely.
 */

interface UploadedFile {
  filename: string
  size: number
  url?: string
  uploaded_at?: string
}

export type OnboardingSection = 'profile' | 'education' | 'activity' | 'testing'

/** The step order the onboarding stepper advertises, kept in one place. */
const NEXT_STEP: Record<OnboardingSection, { section: OnboardingSection | null; href: string }> = {
  profile: { section: 'education', href: '/starter/education' },
  education: { section: 'activity', href: '/starter/activity' },
  activity: { section: 'testing', href: '/starter/testing' },
  testing: { section: null, href: '/home' },
}

export function SectionReview({ section }: { section: OnboardingSection }) {
  const t = useT()
  const { data: session, status } = useSession({ required: false })
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const userId = (session?.user as any)?.id as string | undefined
  const next = NEXT_STEP[section]

  const fetchFiles = useCallback(async () => {
    if (!userId) {
      setError(t('starter.errors.noSession'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/${section}?user_id=${userId}`)
      if (!res.ok) throw new Error(t('starter.errors.loadFailed'))
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('starter.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [userId, section, t])

  useEffect(() => {
    if (status === 'loading') return
    if (!userId) {
      setError(t('starter.errors.signInToView'))
      setLoading(false)
      return
    }
    fetchFiles()
  }, [status, userId, fetchFiles, t])

  async function handleDelete(filename: string) {
    if (!userId) return
    if (!window.confirm(t('starter.confirmDelete').replace('{name}', filename))) return
    setDeleting(filename)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/${section}/${encodeURIComponent(filename)}?user_id=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(t('starter.errors.deleteFailed'))
      await fetchFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('starter.errors.deleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(dateString?: string) {
    if (!dateString) return t('starter.unknownDate')
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return t('starter.unknownDate')
    }
  }

  const title = t(`starter.sections.${section}.title`)
  const uploadHref = `/starter/${section}/upload`

  if (status === 'loading' || loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{t('starter.loading')}</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary motion-reduce:animate-none" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{t(`starter.sections.${section}.description`)}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!error && files.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/40 p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-medium">{t('starter.empty.title')}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t('starter.empty.body')}</p>
          <div className="flex flex-col items-center gap-2">
            <Link href={uploadHref}>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                {t('starter.uploadFiles')}
              </Button>
            </Link>
            {/* Uploading is not mandatory, and a student with nothing to add
                for this section should not be stranded here. */}
            <Link href={next.href} className="text-xs text-muted-foreground hover:text-primary">
              {next.section
                ? t('starter.skipTo').replace('{step}', t(`starter.sections.${next.section}.step`))
                : t('starter.skipToDashboard')}
            </Link>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-lg border">
            <div className="divide-y">
              {files.map((file) => (
                <div key={file.filename} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/50">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileText className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {file.url && (
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          {t('starter.download')}
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.filename)}
                      disabled={deleting === file.filename}
                      aria-label={t('starter.deleteFile').replace('{name}', file.filename)}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === file.filename ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-destructive motion-reduce:animate-none" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={uploadHref} className="flex-1">
              <Button variant="outline" className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {t('starter.uploadMore')}
              </Button>
            </Link>
            <Link href={next.href} className="flex-1">
              <Button className="w-full">
                {next.section
                  ? t('starter.continueTo').replace('{step}', t(`starter.sections.${next.section}.step`))
                  : t('starter.finish')}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
