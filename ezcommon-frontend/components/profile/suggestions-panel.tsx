"use client"
import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { buildFieldSchema } from '@/lib/profile-schema'

interface FileRef {
  filename: string
  section: string
}

interface FieldSuggestion {
  section: string
  field: string
  value: string
  /** Present for repeatable-list fields: groups suggestions belonging to the same new record (e.g. one test sitting). */
  item?: number
  /** Present when the field belongs to a nested repeatable list within a simple section (e.g. Family's Parent/Guardian). */
  nestedKey?: string
}

export function SuggestionsPanel({
  userId,
  currentData,
  onApply,
  onClose,
}: {
  userId: string
  /** Section -> flat field data, used to show "current value" and to skip fields that already have one. */
  currentData: Record<string, Record<string, string> | undefined>
  onApply: (suggestions: FieldSuggestion[]) => void
  onClose: () => void
}) {
  const t = useT()
  const [files, setFiles] = useState<FileRef[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<number | null>(null)

  const fieldSchema = useMemo(() => buildFieldSchema(t), [t])
  const labelFor = (s: FieldSuggestion) => {
    const base = fieldSchema.find((f) => f.section === s.section && f.field === s.field)?.label || s.field
    return s.item !== undefined ? `${base} (${t('profile.suggestions.newRecord').replace('{n}', String(s.item + 1))})` : base
  }

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
      const res = await fetch(`${base}/api/intelligent/extract-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          files: files.map((f) => ({ filename: f.filename, section: f.section })),
          field_schema: fieldSchema,
        }),
      })
      if (!res.ok) throw new Error('Extraction failed')
      const data = await res.json()
      const results: FieldSuggestion[] = data.suggestions || []
      setSuggestions(results)
      // Default-select only fields that are currently empty, so re-running never silently clobbers existing answers.
      const initialSelected = new Set<number>()
      results.forEach((s, i) => {
        if (s.item !== undefined) {
          initialSelected.add(i)
          return
        }
        const current = currentData[s.section]?.[s.field]
        if (!current || !current.trim()) initialSelected.add(i)
      })
      setSelected(initialSelected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setExtracting(false)
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function applySelected() {
    if (!suggestions) return
    const toApply = suggestions.filter((_, i) => selected.has(i))
    onApply(toApply)
    setApplied(toApply.length)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md bg-card border-l shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            {t('profile.findSuggestions')}
          </h2>
          <button onClick={onClose} aria-label={t('profile.suggestions.close')}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {applied !== null ? (
            <div className="text-center py-6">
              <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-foreground">{t('profile.suggestions.appliedSuccess').replace('{count}', String(applied))}</p>
              <Button onClick={onClose} className="mt-4 w-full">
                {t('profile.suggestions.close')}
              </Button>
            </div>
          ) : loadingFiles ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('profile.suggestions.checkingDocs')}
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.suggestions.noDocsYet')}</p>
          ) : suggestions === null ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('profile.suggestions.foundDocs').replace('{count}', String(files.length))}
              </p>
              <Button onClick={runSuggestions} disabled={extracting} className="w-full">
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('profile.suggestions.readingDocs')}
                  </>
                ) : (
                  t('profile.suggestions.runAI')
                )}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.suggestions.noSuggestionsFound')}</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-primary">{t('profile.suggestions.reviewTitle')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('profile.suggestions.reviewSubtitle')}</p>
              </div>
              <div className="space-y-2">
                {suggestions.map((s, i) => {
                  const current = s.item === undefined ? currentData[s.section]?.[s.field] : undefined
                  return (
                    <label key={`${s.section}.${s.nestedKey || ''}.${s.item ?? ''}.${s.field}`} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 mt-0.5 rounded accent-primary shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labelFor(s)}</p>
                        <p className="text-sm text-foreground">{s.value}</p>
                        {current && current.trim() && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('profile.suggestions.currentValueLabel').replace('{value}', current)}
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
              <Button onClick={applySelected} disabled={selected.size === 0} className="w-full">
                {t('profile.suggestions.applySelected')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
