"use client"
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApplicationPortal, SavedCollege } from '@/lib/college-store'
import { PORTAL_LABEL_KEY, resolvePortal } from '@/lib/college-store'
import { useT } from '@/lib/i18n/use-t'

interface Portal {
  portal: ApplicationPortal
  code: string
  href: string | null
}

const PORTALS: Portal[] = [
  { portal: 'commonApp', code: 'CA', href: 'https://apply.commonapp.org/login' },
  { portal: 'uc', code: 'UC', href: 'https://apply.universityofcalifornia.edu' },
  { portal: 'direct', code: 'IP', href: null },
]

export function PortalCards({ colleges }: { colleges: SavedCollege[] }) {
  const t = useT()

  const counts = PORTALS.map((entry) => {
    const mine = colleges.filter((c) => resolvePortal(c.name) === entry.portal)
    return {
      ...entry,
      count: mine.length,
      submitted: mine.filter((c) => c.submitted).length,
    }
  })

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {counts.map((portal, index) => {
        const used = portal.count > 0
        const content = (
          <>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold shrink-0 transition-colors',
                used ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              )}
            >
              {portal.code}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-primary">
                {t(PORTAL_LABEL_KEY[portal.portal])}
                {used && portal.href && <ArrowUpRight className="h-3 w-3 opacity-60" />}
              </span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {t('submit.portals.countLine')
                  .replace('{count}', String(portal.count))
                  .replace('{submitted}', String(portal.submitted))}
              </span>
            </span>
          </>
        )

        // Only a portal the student actually applies through is worth opening.
        return portal.href && used ? (
          <a
            key={portal.code}
            href={portal.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ animationDelay: `${index * 60}ms` }}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all animate-fade-in-up motion-reduce:animate-none"
          >
            {content}
          </a>
        ) : (
          <div
            key={portal.code}
            style={{ animationDelay: `${index * 60}ms` }}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card/60 p-4 animate-fade-in-up motion-reduce:animate-none',
              !used && 'opacity-60',
            )}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
