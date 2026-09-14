"use client"
import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, RotateCcw } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { cn } from '@/lib/utils'

/**
 * A school's application, drawn the way each chapter needs it: rebuilt from
 * nothing (manual), spinning up a fresh AI session, or carried over from
 * context that already exists.
 */
function SchoolCard({
  name,
  mode,
  index,
  active,
}: {
  name: string
  mode: string
  index: number
  active: boolean
}) {
  const rows = [0, 1, 2]
  return (
    <div
      style={{
        transitionDelay: `${index * 90}ms`,
        transform: active ? `translateY(${index % 2 === 0 ? 8 : -8}px)` : 'translateY(24px)',
      }}
      className={cn(
        'w-[116px] sm:w-[140px] lg:w-[168px] shrink-0 rounded-xl border bg-card p-2.5 sm:p-3 shadow-sm transition-all duration-500 ease-out motion-reduce:transition-none',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="flex items-center gap-2">
        {/* A monogram, not a crest: institution marks belong to the institutions. */}
        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary truncate">{name}</p>
          <p className="text-[9px] text-muted-foreground">Application</p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {mode === 'otherAi' && active ? (
          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
            <Loader2 className="h-4 w-4 text-primary/50 animate-spin motion-reduce:animate-none" />
            <span className="text-[9px] text-muted-foreground">new session</span>
          </div>
        ) : (
          rows.map((row) => {
            const filled = mode === 'aipply' || (active && row <= index % 3)
            return (
              <div key={row} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-500',
                    filled ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                  )}
                >
                  {filled && <Check className="h-2 w-2 text-primary-foreground" />}
                </span>
                <span
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-500',
                    filled ? 'bg-accent/40' : 'bg-muted',
                  )}
                />
              </div>
            )
          })
        )}
      </div>

      {mode === 'manual' && active && (
        <p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
          <RotateCcw className="h-2.5 w-2.5" />
          from zero
        </p>
      )}
    </div>
  )
}

function WorkloadChart({ copy }: { copy: LandingCopy }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {copy.why.chart.yLabel}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {copy.why.chart.xLabel}
        </p>
      </div>
      <svg viewBox="0 0 520 200" className="w-full" role="img" aria-label={copy.why.chart.xLabel}>
        <defs>
          <linearGradient id="why-aipply-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="40" x2="500" y1={26 + i * 44} y2={26 + i * 44} stroke="hsl(var(--border))" />
        ))}
        <path
          d="M40 158 C 150 142, 260 92, 500 30"
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="2"
          strokeDasharray="1000"
          className="animate-draw-line motion-reduce:animate-none"
        />
        <path
          d="M40 158 C 160 152, 290 124, 500 78"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeOpacity="0.55"
          strokeDasharray="1000"
          style={{ animationDelay: '250ms' }}
          className="animate-draw-line motion-reduce:animate-none"
        />
        <path d="M40 158 C 180 156, 320 152, 500 148 L500 162 L40 162 Z" fill="url(#why-aipply-fill)" />
        <path
          d="M40 158 C 180 156, 320 152, 500 148"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeDasharray="1000"
          style={{ animationDelay: '500ms' }}
          className="animate-draw-line motion-reduce:animate-none"
        />
        <text x="498" y="22" textAnchor="end" className="fill-muted-foreground" fontSize="10">
          {copy.why.chart.lines[0].label}
        </text>
        <text x="498" y="70" textAnchor="end" className="fill-primary" fontSize="10" opacity="0.7">
          {copy.why.chart.lines[1].label}
        </text>
        <text x="498" y="140" textAnchor="end" className="fill-accent" fontSize="10" fontWeight="600">
          {copy.why.chart.lines[2].label}
        </text>
      </svg>
      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        {copy.why.chart.lines.map((line) => (
          <div key={line.key}>
            <p className={cn('text-xs font-semibold', line.key === 'aipply' ? 'text-accent' : 'text-primary')}>
              {line.label}
            </p>
            <p className="text-[11px] text-muted-foreground">{line.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WhyUs({ copy }: { copy: LandingCopy }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [chapter, setChapter] = useState(0)
  const total = copy.why.chapters.length

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    let frame = 0
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = node!.getBoundingClientRect()
        const scrollable = rect.height - window.innerHeight
        if (scrollable <= 0) return
        // 0 while the top is at the viewport top, 1 once the section is scrolled through.
        const progress = Math.min(Math.max(-rect.top / scrollable, 0), 0.999)
        setChapter(Math.floor(progress * total))
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [total])

  const current = copy.why.chapters[Math.min(chapter, total - 1)]

  return (
    <section id="why" className="relative bg-background">
      {/* The runway is its own box: the sticky chapter only occupies 100vh of
          flow, so anything sharing this box would ride up underneath it. */}
      <div ref={sectionRef} style={{ height: `${total * 100}vh` }}>
      {/* Graph-paper ground, so the cards read as work being laid out on a page. */}
      <div
        aria-hidden
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--border)/0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.35) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-6">
            {copy.why.eyebrow}
          </p>

          <div key={current.title} className="text-center animate-rise-in motion-reduce:animate-none">
            <h2 className="font-display text-3xl sm:text-5xl font-semibold text-primary">{current.title}</h2>
            <p className="font-display text-xl sm:text-3xl mt-2">
              <span className="text-primary font-semibold">{current.lead} </span>
              <span className="italic text-primary/55">{current.emphasis}</span>
            </p>
          </div>

          <p className="mt-8 mb-5 text-xs text-muted-foreground flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3" />
            {current.caption}
          </p>

          <div className="w-full max-w-4xl flex items-center justify-center min-h-[230px]">
            {current.mode === 'chart' ? (
              <WorkloadChart copy={copy} />
            ) : current.mode === 'aipply' ? (
              <div className="w-full max-w-3xl">
                <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                  {copy.why.contextPills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-primary animate-rise-in motion-reduce:animate-none"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {copy.why.reusedSchools.map((school, i) => (
                    <span
                      key={school}
                      style={{ animationDelay: `${i * 100}ms` }}
                      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs text-primary animate-rise-in motion-reduce:animate-none"
                    >
                      <Check className="h-3 w-3 text-emerald-500" />
                      {school}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-nowrap w-full">
                {copy.why.schools.map((school, i) => (
                  <SchoolCard
                    key={school}
                    name={school}
                    mode={current.mode}
                    index={i}
                    active={current.mode !== 'single' || i === 0}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-10">
            {copy.why.chapters.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-0.5 rounded-full transition-all duration-500',
                  i === chapter ? 'w-8 bg-accent' : 'w-4 bg-muted-foreground/25',
                )}
              />
            ))}
          </div>
        </div>

        <p className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 [writing-mode:vertical-rl]">
          {copy.why.axisLabel}
        </p>
      </div>
      </div>

      {/* The counting argument and the closer sit after the pinned run - no
          negative offset, or they ride up over the sticky chapter. */}
      <div className="relative mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <div className="rounded-2xl border bg-card p-6">
            <p className="font-display text-xl text-primary">{copy.why.mathTitle}</p>
            <ul className="mt-4 space-y-3">
              {copy.why.math.map((item) => (
                <li key={item.bold} className="text-sm">
                  <span className="font-semibold text-primary">{item.bold}</span>
                  <span className="text-muted-foreground"> {item.rest}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <p className="font-display text-2xl sm:text-3xl mt-12 text-center">
            {copy.why.closer.map((part) => (
              <span key={part.strong}>
                <span className="text-muted-foreground">{part.muted} </span>
                <span className="text-primary font-semibold">{part.strong} </span>
              </span>
            ))}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
