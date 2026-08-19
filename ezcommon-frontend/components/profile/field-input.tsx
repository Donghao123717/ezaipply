"use client"
import { FieldDef } from '@/lib/profile-schema'
import { useT } from '@/lib/i18n/use-t'

export function FieldInput({
  field,
  value,
  onChange,
  placeholderOverride,
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  /** Dynamic placeholder (e.g. an AI autofill suggestion) that takes precedence over field.placeholderKey. */
  placeholderOverride?: string
}) {
  const t = useT()
  const placeholder = placeholderOverride ?? (field.placeholderKey ? t(field.placeholderKey) : undefined)

  const eyebrow = (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      {t(field.labelKey)}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  const baseInputClass =
    'w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors'

  if (field.type === 'select') {
    return (
      <div>
        {eyebrow}
        <select
          className={baseInputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t('common.selectPlaceholder')}</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {t(`common.options.${opt}`)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'radio') {
    return (
      <div>
        {eyebrow}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name={field.key}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4 accent-primary"
              />
              {t(`common.options.${opt}`)}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'checkbox-multi') {
    const selected = value ? value.split(',').filter(Boolean) : []
    function toggle(opt: string) {
      const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]
      onChange(next.join(','))
    }
    return (
      <div>
        {eyebrow}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-4 w-4 rounded accent-primary"
              />
              {t(`common.options.${opt}`)}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {eyebrow}
        <textarea
          className={`${baseInputClass} min-h-24 resize-y`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  return (
    <div>
      {eyebrow}
      <input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        className={baseInputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
