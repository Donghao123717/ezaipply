import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Section {
  key: string
  label: string
  entries: { label: string; value: string }[]
}

export function ProfilePullPage({ sections }: { sections: Section[] }) {
  const hasAny = sections.some((s) => s.entries.length > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Pulled automatically from your Common Profile.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">
            Edit in Profile
            <ExternalLink className="h-3 w-3 ml-1.5" />
          </Link>
        </Button>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet - fill out the relevant section of your Profile and it will show up here automatically.
        </div>
      ) : (
        <div className="space-y-6">
          {sections
            .filter((s) => s.entries.length > 0)
            .map((section) => (
              <div key={section.key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {section.label}
                </p>
                <div className="rounded-xl border divide-y">
                  {section.entries.map((entry, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">{entry.label}</span>
                      <span className="text-sm font-medium text-primary text-right">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
