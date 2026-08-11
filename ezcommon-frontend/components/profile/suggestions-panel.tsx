"use client"
import { useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileRef {
  filename: string
  section: string
}

interface Chunk {
  category: string
  information: string
  source_file: string
  section: string
}

export function SuggestionsPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [files, setFiles] = useState<FileRef[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [chunks, setChunks] = useState<Chunk[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    fetch(`${base}/api/intelligent/files?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => setFiles(d.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoadingFiles(false))
  }, [userId])

  async function runSuggestions() {
    setExtracting(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/intelligent/extract?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          files: files.map((f) => ({ filename: f.filename, section: f.section })),
        }),
      })
      if (!res.ok) throw new Error('Extraction failed')
      const data = await res.json()
      setChunks(data.chunks || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md bg-card border-l shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Find Suggestions
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadingFiles ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your uploaded documents…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t uploaded any documents yet. Upload a transcript, test scores, or activity records
              elsewhere in the app, then come back here to pull suggested details from them.
            </p>
          ) : chunks === null ? (
            <>
              <p className="text-sm text-muted-foreground">
                Found {files.length} document{files.length !== 1 ? 's' : ''}. We&apos;ll read them with AI and surface
                details you can copy into your profile.
              </p>
              <Button onClick={runSuggestions} disabled={extracting} className="w-full">
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reading your documents…
                  </>
                ) : (
                  'Run AI Suggestions'
                )}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          ) : chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions found in your uploaded documents.</p>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent">{chunk.category}</span>
                    <span className="text-xs text-muted-foreground">{chunk.source_file}</span>
                  </div>
                  <p className="text-sm text-foreground">{chunk.information}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
