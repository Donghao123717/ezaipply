"use client"
import { useT } from '@/lib/i18n/use-t'

export function NotesPage({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {t('applicationForm.notes.label')}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('applicationForm.notes.placeholder')}
        className="w-full min-h-40 rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
      />
    </div>
  )
}
