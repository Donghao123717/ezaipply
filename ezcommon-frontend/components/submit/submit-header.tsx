import type { SavedCollege } from '@/lib/college-store'

export function SubmitHeader({ firstName, colleges }: { firstName: string; colleges: SavedCollege[] }) {
  const total = colleges.length
  const submitted = colleges.filter((c) => c.submitted).length
  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-card to-secondary/40 p-6 flex items-center justify-between gap-6 mb-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Stage 5 · Submit</p>
        <h1 className="font-display text-3xl font-semibold text-primary">
          You&apos;re almost there{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          You&apos;ve submitted {submitted} of {total}. {Math.max(total - submitted, 0)} more to the finish line. We&apos;ve
          prepped everything you need below.
        </p>
      </div>
      <div className="shrink-0 relative h-20 w-20">
        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeDasharray={`${percent} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-primary leading-none">
            {submitted}/{total}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">Submitted</span>
        </div>
      </div>
    </div>
  )
}
