"use client"
import { useState } from 'react'
import { ChevronDown, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import type { CaseNote } from '@/lib/case-notes-store'
import type { CounselorTab } from '@/lib/counselor-chat'

const SOURCE_LABEL_KEY: Record<CounselorTab, string> = {
  team: 'counselor.personas.team.navLabel',
  strategist: 'counselor.personas.strategist.navLabel',
  essay: 'counselor.personas.essay.navLabel',
  coordinator: 'counselor.personas.coordinator.navLabel',
}

/**
 * The shared case file, shown as a one-line summary that expands. Every
 * specialist writes here, so the count is how much this team already knows
 * without the student repeating it.
 */
export function CaseNotes({
  notes,
  activeTab,
  onRemove,
}: {
  notes: CaseNote[]
  activeTab: CounselorTab
  onRemove: (id: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={notes.length === 0}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors',
          notes.length > 0 ? 'text-muted-foreground hover:text-foreground hover:bg-muted/40' : 'text-muted-foreground/60',
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {t('counselor.notes.sharedWith')
            .replace('{count}', String(notes.length))
            .replace('{agent}', t(SOURCE_LABEL_KEY[activeTab]))}
        </span>
        {notes.length > 0 && (
          <ChevronDown className={cn('h-3.5 w-3.5 ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && notes.length > 0 && (
        <ul className="max-h-48 overflow-y-auto px-4 pb-3 space-y-1.5">
          {notes.map((note, index) => (
            <li
              key={note.id}
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              className="group flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 animate-fade-in-up motion-reduce:animate-none"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground leading-relaxed">{note.text}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t(SOURCE_LABEL_KEY[note.source])}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(note.id)}
                aria-label={t('counselor.notes.remove')}
                className="rounded p-0.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-all"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
