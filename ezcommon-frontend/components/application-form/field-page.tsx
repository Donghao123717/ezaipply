import { Plus } from 'lucide-react'
import type { FieldGroup } from '@/lib/profile-schema'
import { FieldInput } from '@/components/profile/field-input'
import type { ApplicationAnswers } from '@/lib/application-store'

export function FieldPage({
  groups,
  answers,
  onChange,
}: {
  groups: FieldGroup[]
  answers: ApplicationAnswers
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'pt-6 border-t' : ''}>
          {group.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{group.eyebrow}</p>
          )}
          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.key} className="rounded-xl border p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <FieldInput field={field} value={answers[field.key] || ''} onChange={(v) => onChange(field.key, v)} />
                </div>
                <button
                  type="button"
                  className="mt-6 shrink-0 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  title="Add an alternate answer for a different school"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
