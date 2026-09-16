"use client"
import { useEffect, useId, useMemo, useState } from 'react'
import { FieldDef, fieldLabel, isNotApplicable, notApplicableValue } from '@/lib/profile-schema'
import { useT } from '@/lib/i18n/use-t'
import { useLocale } from '@/lib/i18n/locale-context'


/**
 * Year / month / day as three dropdowns, holding an ISO "YYYY-MM-DD" string.
 *
 * `<input type="date">` looked like the obvious answer and is the wrong one for
 * a date of birth. Its picker opens on the current month, and reaching 2008
 * means paging back two hundred times; Firefox's calendar has no year jump at
 * all, and Safari on macOS renders no picker, just a field that silently
 * rejects anything not in the browser's own format. Students reported simply
 * not being able to choose a year.
 *
 * Three selects work identically in every browser, are typeable (a native
 * select jumps to "2008" as you type it), and read the way the paper form
 * does. The value stored is unchanged, so saved profiles and the PDF export
 * carry on working.
 */
const EARLIEST_YEAR_OFFSET = 90
const LATEST_YEAR_OFFSET = 15

function splitISO(value: string): { y: string; m: string; d: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  return match ? { y: match[1], m: match[2], d: match[3] } : { y: '', m: '', d: '' }
}

function daysInMonth(year: string, month: string): number {
  if (!month) return 31
  // A day count needs a year for February; without one, offer 29 so a leap-day
  // birthday can still be picked before the year is chosen.
  const y = year ? Number(year) : 2024
  return new Date(y, Number(month), 0).getDate()
}

function DateField({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const t = useT()
  const { locale } = useLocale()
  const [parts, setParts] = useState(() => splitISO(value))

  // Adopt a value set from outside (AI autofill, a restored profile), but never
  // clobber a half-finished selection: an incomplete date reports itself as
  // empty, and resyncing on that would erase the year the moment it was picked.
  useEffect(() => {
    if (!value) return
    const next = splitISO(value)
    setParts((prev) => (prev.y === next.y && prev.m === next.m && prev.d === next.d ? prev : next))
  }, [value])

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const list: string[] = []
    for (let y = now + LATEST_YEAR_OFFSET; y >= now - EARLIEST_YEAR_OFFSET; y--) list.push(String(y))
    return list
  }, [])

  const months = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'long' })
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1).padStart(2, '0'),
      label: format.format(new Date(2024, i, 1)),
    }))
  }, [locale])

  const maxDay = daysInMonth(parts.y, parts.m)
  const days = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0')),
    [maxDay],
  )

  function update(next: { y: string; m: string; d: string }) {
    // Shortening the month drops an impossible day rather than saving 31 June.
    if (next.d && Number(next.d) > daysInMonth(next.y, next.m)) next = { ...next, d: '' }
    setParts(next)
    onChange(next.y && next.m && next.d ? `${next.y}-${next.m}-${next.d}` : '')
  }

  const selectClass =
    'rounded-lg border bg-card px-2 py-2.5 text-sm outline-none transition-colors focus:border-primary'

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        aria-label={t('common.date.year')}
        required={required}
        className={selectClass}
        value={parts.y}
        onChange={(e) => update({ ...parts, y: e.target.value })}
      >
        <option value="">{t('common.date.year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        aria-label={t('common.date.month')}
        required={required}
        className={selectClass}
        value={parts.m}
        onChange={(e) => update({ ...parts, m: e.target.value })}
      >
        <option value="">{t('common.date.month')}</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <select
        aria-label={t('common.date.day')}
        required={required}
        className={selectClass}
        value={parts.d}
        onChange={(e) => update({ ...parts, d: e.target.value })}
      >
        <option value="">{t('common.date.day')}</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {Number(d)}
          </option>
        ))}
      </select>
    </div>
  )
}

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
  // Radios with the same `name` are one group as far as the browser is
  // concerned, and only one of them may be checked. Two test scores, or two
  // activities, would therefore share a single group: React would set the
  // second entry's value in state, the browser would refuse to show it
  // checked, and the field read as "clicking does nothing". Scoping the name
  // to this instance keeps each entry's radios a group of their own.
  const groupId = useId()
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

  /**
   * The form's own "Does Not Apply" / "Do Not Know" box.
   *
   * Without it, "I have no US social security number" and "I have not got to
   * that yet" are the same empty field, so the form keeps asking about
   * something already settled and the applicant has no way to say so. Ticking
   * it writes a value, which is what makes the question stop.
   */
  const marked = isNotApplicable(value)
  const notApplicableBox = field.notApplicable ? (
    <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={marked}
        onChange={(e) => onChange(e.target.checked ? notApplicableValue(field.notApplicable!) : '')}
        className="h-3.5 w-3.5 rounded accent-primary"
      />
      {t(field.notApplicable === 'doNotKnow' ? 'common.doNotKnow' : 'common.doesNotApply')}
    </label>
  ) : null

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
                name={`${groupId}-${field.key}`}
                value={opt}
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

  if (field.type === 'date') {
    return (
      <div>
        {eyebrow}
        {marked ? (
          <input className={`${baseInputClass} text-muted-foreground`} value={value} disabled readOnly />
        ) : (
          <DateField value={value} onChange={onChange} required={field.required} />
        )}
        {notApplicableBox}
      </div>
    )
  }

  return (
    <div>
      {eyebrow}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        className={marked ? `${baseInputClass} text-muted-foreground` : baseInputClass}
        value={value}
        placeholder={placeholder}
        maxLength={field.maxChars}
        disabled={marked}
        onChange={(e) => onChange(e.target.value)}
      />
      {notApplicableBox}
    </div>
  )
}
