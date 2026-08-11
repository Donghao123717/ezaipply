"use client"
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

export interface ChecklistItem {
  key: string
  titleKey: string
  subtitleKey: string
  href: string
  done: boolean
}

export function Checklist({ items }: { items: ChecklistItem[] }) {
  const t = useT()
  const doneCount = items.filter((i) => i.done).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-primary">{t('home.checklistTitle')}</h2>
          <span className="text-sm text-muted-foreground">
            {doneCount} / {items.length} {t('home.checklistStarted')}
          </span>
        </div>
        <Link href="/counselor" className="text-sm text-primary underline underline-offset-2">
          {t('home.askCounselor')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group flex items-start gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                item.done ? 'bg-primary border-primary' : 'border-muted-foreground/40',
              )}
            >
              {item.done && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-display font-semibold text-primary leading-tight">{t(item.titleKey)}</span>
              <span className="block text-sm text-muted-foreground mt-0.5">{t(item.subtitleKey)}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  )
}
