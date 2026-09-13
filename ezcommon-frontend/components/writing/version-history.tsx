"use client"
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, History, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { deleteVersion, loadVersions, saveVersion, type EssayVersion } from '@/lib/essay-versions-store'
import { timeAgo } from '@/lib/forecast-store'

export function VersionHistory({
  userId,
  taskId,
  html,
  onRestore,
}: {
  userId: string
  taskId: string
  html: string
  onRestore: (html: string) => void
}) {
  const t = useT()
  const [versions, setVersions] = useState<EssayVersion[]>([])
  const [open, setOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVersions(loadVersions(userId)[taskId] || [])
    setOpen(false)
  }, [userId, taskId])

  useEffect(() => {
    if (!open) return
    function onClickAway(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  function keep() {
    const next = saveVersion(userId, taskId, html)
    setVersions(next[taskId] || [])
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1800)
  }

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <Button size="sm" variant="outline" onClick={keep} disabled={!html.trim()} className="rounded-r-none">
        {justSaved ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <History className="h-3.5 w-3.5 mr-1.5" />}
        {justSaved ? t('writing.versions.saved') : t('writing.versions.save')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('writing.versions.title')}
        aria-expanded={open}
        className="rounded-l-none border-l-0 px-2"
      >
        <span className="text-xs tabular-nums mr-1">{versions.length}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border bg-card shadow-lg animate-fade-in-up motion-reduce:animate-none">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b">
            {t('writing.versions.title')}
          </p>
          {versions.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">{t('writing.versions.empty')}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {versions.map((version, i) => (
                <li
                  key={version.id}
                  style={{ animationDelay: `${Math.min(i, 6) * 35}ms` }}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 animate-fade-in-up motion-reduce:animate-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground tabular-nums">
                      {t('writing.versions.words').replace('{words}', String(version.words))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(version.savedAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(version.html)
                      setOpen(false)
                    }}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-primary hover:bg-muted"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    {t('writing.versions.restore')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVersions(deleteVersion(userId, taskId, version.id)[taskId] || [])}
                    aria-label={t('writing.versions.delete')}
                    className="rounded p-0.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t leading-relaxed">
            {t('writing.versions.hint')}
          </p>
        </div>
      )}
    </div>
  )
}
