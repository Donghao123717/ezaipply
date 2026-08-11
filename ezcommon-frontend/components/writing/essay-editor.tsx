"use client"
import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline } from 'lucide-react'
import { cn } from '@/lib/utils'
import { wordCount } from '@/lib/essay-store'

export function EssayEditor({
  html,
  onChange,
}: {
  html: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [autoSave, setAutoSave] = useState(true)

  // Keep the DOM in sync when switching essays, without fighting the
  // contentEditable cursor on every keystroke of the same essay.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  function exec(command: string) {
    document.execCommand(command)
    ref.current?.focus()
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const count = wordCount(html)

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => exec('bold')}
            className="rounded p-1.5 hover:bg-muted text-foreground"
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('italic')}
            className="rounded p-1.5 hover:bg-muted text-foreground"
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('underline')}
            className="rounded p-1.5 hover:bg-muted text-foreground"
            aria-label="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{count} Words</span>
          <button
            type="button"
            onClick={() => setAutoSave((v) => !v)}
            className="flex items-center gap-1.5"
          >
            Auto-save
            <span
              className={cn(
                'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                autoSave ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                  autoSave ? 'translate-x-3.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder="Opening hook, key experiences, why this school, values you bring…"
        className="min-h-[360px] px-6 py-5 text-sm leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
      />
    </div>
  )
}
