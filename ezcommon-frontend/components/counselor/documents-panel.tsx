"use client"
import { useEffect, useRef, useState } from 'react'
import { Loader2, Paperclip, Search, Upload, X } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

export interface CounselorDoc {
  filename: string
  size: number
  section: string
  s3_key: string
  url?: string
}

export function DocumentsPanel({
  userId,
  refreshSignal,
  onUploaded,
}: {
  userId: string
  /** Bump this from a parent to force a re-fetch (e.g. after a chat "+" attach upload). */
  refreshSignal?: number
  onUploaded?: () => void
}) {
  const t = useT()
  const [files, setFiles] = useState<CounselorDoc[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/upload/user/${encodeURIComponent(userId)}`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshSignal])

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
      onUploaded?.()
    } finally {
      setUploading(false)
    }
  }

  async function remove(f: CounselorDoc) {
    setFiles((prev) => prev.filter((x) => x.s3_key !== f.s3_key))
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    await fetch(`${base}/api/upload/file?s3_key=${encodeURIComponent(f.s3_key)}&user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
  }

  const filtered = files.filter((f) => f.filename.toLowerCase().includes(query.toLowerCase()))

  return (
    <aside className="w-72 shrink-0 border-r bg-card/50 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="font-semibold text-primary mb-3">{t('counselor.documents.title')}</h2>

        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('counselor.documents.searchPlaceholder')}
            className="w-full rounded-lg border bg-card pl-8 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

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
          <p className="text-sm font-medium text-primary">
            {files.length === 0 ? t('counselor.documents.dropTitleEmpty') : t('counselor.documents.dropTitle')}
          </p>
          <p className="text-xs text-muted-foreground">{t('counselor.documents.dropSubtitle')}</p>
          <p className="text-xs text-muted-foreground/70">{t('counselor.documents.dropHint')}</p>
          <input
            ref={inputRef}
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

        <div className="mt-4 space-y-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t('counselor.documents.loading')}</p>
          ) : (
            filtered.map((f) => (
              <div key={f.s3_key} className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1" title={f.filename}>
                  {f.filename}
                </span>
                <button
                  onClick={() => remove(f)}
                  aria-label={t('counselor.documents.remove').replace('{filename}', f.filename)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
