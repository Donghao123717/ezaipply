import type { SavedCollege } from '@/lib/college-store'

interface Portal {
  code: string
  label: string
  href: string | null
}

const PORTALS: Portal[] = [
  { code: 'CA', label: 'Common App', href: 'https://apply.commonapp.org/login' },
  { code: 'UC', label: 'UC Application', href: 'https://apply.universityofcalifornia.edu' },
  { code: 'HB', label: 'HBCU Application', href: null },
  { code: 'IP', label: 'Independent portals', href: null },
]

export function PortalCards({ colleges }: { colleges: SavedCollege[] }) {
  // Every saved school in this demo is assumed to apply through the Common App.
  const commonAppSubmitted = colleges.filter((c) => c.submitted).length

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {PORTALS.map((portal) => {
        const count = portal.label === 'Common App' ? colleges.length : 0
        const submitted = portal.label === 'Common App' ? commonAppSubmitted : 0
        const content = (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-bold shrink-0">
              {portal.code}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-primary">{portal.label}</span>
              <span className="block text-xs text-muted-foreground">
                {count} school{count !== 1 ? 's' : ''} · {submitted} submitted
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
