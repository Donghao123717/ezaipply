"use client"
import { FieldDef, fieldLabel } from '@/lib/profile-schema'
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
    <label className="block mb-1.5">
      <span
        className={
          // A school's own question is a sentence, sometimes a long one - it
          // needs sentence case and normal leading, not the cramped uppercase
          // treatment that suits our own short field names.
          field.label
            ? 'block text-sm font-medium text-primary'
            : 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground'
        }
      >
        {fieldLabel(field, t)}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {field.help && (
        <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{field.help}</span>
      )}
    </label>
  )

  const baseInputClass =
    'w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors'

  // A select with nothing to select from is a dead end - the student can see
  // the question and cannot answer it. That should never ship, but when a
  // school's option list is missing, letting them type the answer is strictly
  // better than a disabled-looking dropdown.
  if (field.type === 'select' && !field.options?.length) {
    return (
      <div>
        {eyebrow}
        <input
          type="text"
          className={baseInputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

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
              {field.optionsLiteral ? opt : t(`common.options.${opt}`)}
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
              {field.optionsLiteral ? opt : t(`common.options.${opt}`)}
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
              {field.optionsLiteral ? opt : t(`common.options.${opt}`)}
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
          maxLength={field.maxChars}
          onChange={(e) => onChange(e.target.value)}
        />
        {/* Real forms truncate silently at their cap; show the budget instead. */}
        {field.maxChars && (
          <p
            className={
              value.length > field.maxChars * 0.9
                ? 'mt-1 text-right text-[11px] tabular-nums text-destructive'
                : 'mt-1 text-right text-[11px] tabular-nums text-muted-foreground'
            }
          >
            {value.length} / {field.maxChars}
          </p>
        )}
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
        maxLength={field.maxChars}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
