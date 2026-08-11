"use client"
import { Plus } from 'lucide-react'
import type { FieldGroup } from '@/lib/profile-schema'
import { FieldInput } from '@/components/profile/field-input'
import type { ApplicationAnswers } from '@/lib/application-store'
import { useT } from '@/lib/i18n/use-t'

export function FieldPage({
  groups,
  answers,
  suggestions,
  onChange,
}: {
  groups: FieldGroup[]
  answers: ApplicationAnswers
  suggestions?: Record<string, string> | null
  onChange: (key: string, value: string) => void
}) {
  const t = useT()
  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'pt-6 border-t' : ''}>
          {group.eyebrowKey && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t(group.eyebrowKey)}</p>
          )}
          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.key} className="rounded-xl border p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <FieldInput
                    field={field}
                    value={answers[field.key] || ''}
                    onChange={(v) => onChange(field.key, v)}
                    placeholderOverride={
                      suggestions?.[field.key] ? t('applicationForm.suggestedPrefix').replace('{value}', suggestions[field.key]) : undefined
                    }
                  />
                </div>
                <button
                  type="button"
                  className="mt-6 shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  title={t('applicationForm.addAlternateTitle')}
                >
                  <Plus className="h-3 w-3" />
                  {t('common.add')}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
