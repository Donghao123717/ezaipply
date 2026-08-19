"use client"
import { useEffect, useRef, useState } from 'react'
import { Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

interface ProfileDoc {
  filename: string
  size: number
  section: string
  s3_key: string
  url?: string
}

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
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/user/${encodeURIComponent(userId)}`)
      const data = await res.json()
      const list: ProfileDoc[] = data.files || []
      setFiles(list)
      onCountChange?.(list.length)
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('user_id', userId)
      Array.from(fileList).forEach((f) => form.append('files', f))
      await fetch(`${base}/api/upload/profile`, { method: 'POST', body: form })
      await refresh()
    } finally {
      setUploading(false)
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
      <div className="h-full w-full max-w-md bg-card border-l shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-accent" />
            {t('profile.files.title')}
          </h2>
          <button onClick={onClose} aria-label={t('profile.suggestions.close')}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              upload(e.dataTransfer.files)
            }}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-secondary/40' : 'hover:border-primary'
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <p className="text-sm font-medium text-primary">{t('profile.files.dropTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('profile.files.dropHint')}</p>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                upload(e.target.files)
                e.target.value = ''
              }}
            />
          </label>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('profile.files.loading')}</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('profile.files.empty')}</p>
          ) : (
            <div className="space-y-1">
              {files.map((f) => (
                <div key={f.s3_key} className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate flex-1 hover:underline"
                    title={f.filename}
                  >
                    {f.filename}
                  </a>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                  <button
                    onClick={() => remove(f)}
                    aria-label={t('profile.files.remove').replace('{filename}', f.filename)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
