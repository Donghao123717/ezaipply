"use client"
import type { SavedCollege } from '@/lib/college-store'
import { useT } from '@/lib/i18n/use-t'

interface Portal {
  code: string
  labelKey: string
  href: string | null
}

const PORTALS: Portal[] = [
  { code: 'CA', labelKey: 'submit.portals.commonApp', href: 'https://apply.commonapp.org/login' },
  { code: 'UC', labelKey: 'submit.portals.ucApplication', href: 'https://apply.universityofcalifornia.edu' },
  { code: 'HB', labelKey: 'submit.portals.hbcuApplication', href: null },
  { code: 'IP', labelKey: 'submit.portals.independentPortals', href: null },
]

export function PortalCards({ colleges }: { colleges: SavedCollege[] }) {
  const t = useT()
  // Every saved school in this demo is assumed to apply through the Common App.
  const commonAppSubmitted = colleges.filter((c) => c.submitted).length

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {PORTALS.map((portal) => {
        const label = t(portal.labelKey)
        const count = portal.labelKey === 'submit.portals.commonApp' ? colleges.length : 0
        const submitted = portal.labelKey === 'submit.portals.commonApp' ? commonAppSubmitted : 0
        const content = (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-bold shrink-0">
              {portal.code}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-primary">{label}</span>
              <span className="block text-xs text-muted-foreground">
                {t('submit.portals.countLine').replace('{count}', String(count)).replace('{submitted}', String(submitted))}
              </span>
            </span>
          </>
        )
        return portal.href ? (
          <a
            key={portal.code}
            href={portal.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors"
          >
            {content}
          </a>
        ) : (
          <div key={portal.code} className="flex items-center gap-3 rounded-xl border bg-card/60 p-4 opacity-60">
            {content}
          </div>
        )
      })}
    </div>
  )
}
