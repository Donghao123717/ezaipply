"use client"
import { Briefcase, GraduationCap, Plane } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { VISA_TYPES, type VisaType } from '@/lib/visa-chat-store'

/**
 * Which visa, asked before anything else.
 *
 * Almost everything downstream forks on this: which documents are collected,
 * what the checklist says to bring, which pages of the DS-160 apply, what the
 * interview asks and what the risk review looks for. Choosing it later means
 * showing a visitor the F-1 checklist and asking a student for their H-1B
 * approval notice in the meantime, which is how people stop believing any of
 * it applies to them.
 */

const ICONS: Record<VisaType, LucideIcon> = {
  B1B2: Plane,
  F1: GraduationCap,
  H1B: Briefcase,
}

export function VisaTypePicker({
  value,
  onChange,
  compact,
}: {
  value: VisaType | null
  onChange: (next: VisaType) => void
  /** The header version, once a choice has been made. */
  compact?: boolean
}) {
  const t = useT()

  if (compact && value) {
    return (
      <div className="flex items-center gap-0.5 rounded-full border bg-card p-0.5">
        {VISA_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              value === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary',
            )}
          >
            {t(`visaType.${type}.short`)}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {VISA_TYPES.map((type) => {
        const Icon = ICONS[type]
        const active = value === type
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              'rounded-2xl border p-5 text-left transition-colors',
              active ? 'border-primary bg-secondary/50' : 'bg-card hover:border-primary/40',
            )}
          >
            <span
              className={cn(
                'mb-3 flex h-10 w-10 items-center justify-center rounded-xl border',
                active ? 'border-primary/30 bg-card text-primary' : 'bg-background text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <p className="font-display text-lg font-semibold text-primary">{t(`visaType.${type}.title`)}</p>
            <p className="mt-0.5 text-xs font-medium text-accent">{t(`visaType.${type}.who`)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`visaType.${type}.blurb`)}</p>
          </button>
        )
      })}
    </div>
  )
}
