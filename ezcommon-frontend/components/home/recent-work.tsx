"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, GraduationCap, MessageSquare } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'
import { computeRecentActivity, type RecentActivityItem } from '@/lib/recent-activity'
import { timeAgo } from '@/lib/forecast-store'

const icons = {
  writing: BookOpen,
  counselor: MessageSquare,
  colleges: GraduationCap,
}

export function RecentWork({ userId }: { userId: string }) {
  const t = useT()
  const [items, setItems] = useState<RecentActivityItem[] | null>(null)

  useEffect(() => {
    setItems(computeRecentActivity(userId, t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    // Framed like the checklist, and for the same reason: the rail was a
    // heading with a white card under it, indistinguishable from the cards in
    // the main column.
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-primary mb-3">{t('home.recentWork')}</h2>
      {items === null ? null : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
          {t('home.recentEmpty')}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-background">
          {items.map((item) => {
            const Icon = icons[item.type]
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-primary truncate">{item.label}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
