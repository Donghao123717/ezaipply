"use client"
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Check, Loader2, PenLine, RotateCcw } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { SchoolLogo } from '@/components/landing/school-logo'
import { cn } from '@/lib/utils'

/**
 * The scale story: one long pinned run that scrubs through six beats as the
 * reader scrolls. Each beat gets roughly 1.75 screens of scroll, which is what
 * makes the motion read as a narrative being played rather than a set of
 * slides being swapped - the same beat length the reference page uses.
 */
const BEAT_VH = 140

/**
 * Every beat's motion is scheduled inside this window. Leaving a margin at
 * each end gives the cross-fade somewhere to happen; running past END would
 * strand whatever is still animating when the beat flips.
 */
const START = 0.06
const END = 0.85

/** 0 outside [a,b], 1 past b, eased in between - linear reads as mechanical. */
function ramp(value: number, a: number, b: number) {
  if (b <= a) return value >= b ? 1 : 0
  const t = Math.min(Math.max((value - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Slot `index` of `count` inside the beat window, each slot lasting `hold` of
 * the window. Spreading the starts across what is left means the last item
 * finishes near END instead of halfway through, so there is no stretch of
 * scrolling where nothing moves.
 */
function slot(index: number, count: number, hold = 0.45, from = START): [number, number] {
  const span = END - from
  const step = count > 1 ? (span * (1 - hold)) / (count - 1) : 0
  const begin = from + index * step
  return [begin, begin + span * hold]
}

/** A school's application card, drawn differently per beat. */
function SchoolCard({
  name,
  mode,
  index,
  count,
  progress,
}: {
  name: string
  mode: string
  index: number
  count: number
  progress: number
}) {
  // Cards arrive one after another rather than all at once.
  const [cardIn, cardOut] = slot(index, count, 0.4)
  const arrival = ramp(progress, cardIn, cardOut)
  const rows = [0, 1, 2]

  return (
    <div
      style={{
        opacity: arrival,
        transform: `translateY(${(1 - arrival) * 26 + (index % 2 === 0 ? 6 : -6)}px) scale(${0.94 + arrival * 0.06})`,
        zIndex: 10 - index,
      }}
      className="w-[128px] sm:w-[150px] lg:w-[172px] shrink-0 rounded-xl border bg-card p-3 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.45)] motion-reduce:!opacity-100 motion-reduce:!transform-none"
    >
      <div className="flex items-center gap-2">
        <SchoolLogo name={name} className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-primary">{name}</p>
          <p className="text-[9px] text-muted-foreground">Application</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {mode === 'otherAi' ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary/45 motion-reduce:animate-none" />
            <span className="text-[9px] text-muted-foreground">new session</span>
          </div>
        ) : (
          rows.map((row) => {
            // Each row is filled in turn, and the pen sits on the row being
            // written. Rows share one schedule across every card, so the last
            // card's last row still lands inside the beat.
            const [rowStart, rowEnd] = slot(index * 3 + row, count * 3, 0.22)
            const filled = progress > rowEnd
            const writing = progress > rowStart && !filled
            return (
              <div key={row} className="relative flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-300',
                    filled ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                  )}
                >
                  {filled && <Check className="h-2 w-2 text-primary-foreground" />}
                </span>
                <span
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-300',
                    filled ? 'bg-accent/40' : 'bg-muted',
                  )}
                />
                {writing && (
                  <PenLine
                    aria-hidden
                    className="absolute left-6 h-3 w-3 -translate-y-0.5 text-accent"
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {mode === 'manual' && (
        <p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
          <RotateCcw className="h-2.5 w-2.5" />
          from zero
        </p>
      )}
    </div>
  )
}

/** The centre of the radial beats: one context card inside a breathing ring. */
function ContextHub({ copy, glow }: { copy: LandingCopy; glow: number }) {
  const tints = [
    'bg-amber-50 text-amber-900 border-amber-200',
    'bg-emerald-50 text-emerald-900 border-emerald-200',
    'bg-sky-50 text-sky-900 border-sky-200',
    'bg-violet-50 text-violet-900 border-violet-200',
  ]
  return (
    <div className="relative flex h-[230px] w-[230px] items-center justify-center">
      <span
        aria-hidden
        style={{ opacity: glow }}
        className="absolute inset-0 rounded-full bg-accent/10 blur-2xl"
      />
      <span
        aria-hidden
        style={{ opacity: glow }}
        className="absolute inset-2 animate-core-breathe rounded-full border border-accent/30 motion-reduce:animate-none"
      />
      <span
        aria-hidden
        style={{ opacity: glow * 0.8 }}
        className="absolute inset-0 animate-core-spin rounded-full border border-dashed border-accent/25 motion-reduce:animate-none"
      />
      <div className="relative w-[150px] rounded-xl border bg-card p-2.5 shadow-[0_16px_40px_-24px_hsl(var(--primary)/0.5)]">
        <p className="mb-2 text-[7px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {copy.why.hubLabel}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {copy.why.contextPills.map((pill, i) => (
            <span
              key={pill}
              className={cn(
                'rounded-md border px-1.5 py-2 text-center text-[8px] font-medium leading-tight',
                tints[i % tints.length],
              )}
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Dashed routes fanning out from the hub to six school nodes, drawn as the
 * reader scrolls, with packets running along them once a route is complete.
 */
function RadialRoutes({ copy, progress }: { copy: LandingCopy; progress: number }) {
  const nodes = copy.why.reusedSchools.slice(0, 6)
  const cx = 500
  const cy = 250
  const radii = { x: 400, y: 190 }
  // Two arcs of three, above and below the hub, mirroring the reference layout.
  const angles = [-145, -90, -35, 145, 90, 35]

  return (
    <div className="relative w-full max-w-4xl">
      <svg viewBox="0 0 1000 500" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="why-route" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        {angles.map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const x = cx + Math.cos(rad) * radii.x
          const y = cy + Math.sin(rad) * radii.y
          // Bow each route outward so they read as distinct paths, not spokes.
          const mx = cx + Math.cos(rad) * radii.x * 0.55
          const my = cy + Math.sin(rad) * radii.y * 0.8
          const d = `M ${cx} ${cy} Q ${mx} ${my} ${x} ${y}`
          const [a, b] = slot(i, angles.length, 0.5)
          const draw = ramp(progress, a, b)
          const done = draw >= 1
          return done ? (
            // Complete: switch to the dashed pattern and let it flow outward.
            <path
              key={angle}
              d={d}
              fill="none"
              stroke="url(#why-route)"
              strokeWidth="1.6"
              strokeDasharray="6 6"
              className="animate-route-flow motion-reduce:animate-none"
            />
          ) : (
            // Drawing: pathLength 1 makes the dash array a plain 0-1 fraction,
            // so `draw` reveals exactly that much of the route.
            <path
              key={angle}
              d={d}
              fill="none"
              stroke="url(#why-route)"
              strokeWidth="1.6"
              pathLength={1}
              strokeDasharray={`${draw} 1`}
            />
          )
        })}
      </svg>

      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const leftPct = ((cx + Math.cos(rad) * radii.x) / 1000) * 100
        const topPct = ((cy + Math.sin(rad) * radii.y) / 500) * 100
        const [a, b] = slot(i, angles.length, 0.5)
        // A node lights up as its own route lands, not on a separate clock.
        const arrived = ramp(progress, a + (b - a) * 0.75, b + 0.04)
        return (
          <span
            key={angle}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              opacity: arrived,
              animationDelay: `${i * 0.18}s`,
            }}
            className={cn(
              '-translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-[10px] font-medium text-primary shadow-sm',
              arrived > 0.98 && 'animate-node-receive motion-reduce:animate-none',
            )}
          >
            <SchoolLogo name={nodes[i] ?? ''} className="h-4 w-4 shrink-0" />
            {nodes[i]}
            <Check
              style={{ animationDelay: `${i * 0.18}s` }}
              className="h-2.5 w-2.5 animate-check-receive text-emerald-500 motion-reduce:animate-none"
            />
          </span>
        )
      })}

      {/* The hub sits on top of the route origins. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ContextHub copy={copy} glow={1} />
      </div>
    </div>
  )
}

function WorkloadChart({ copy }: { copy: LandingCopy }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex items-start justify-between gap-4">
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
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
  const runwayRef = useRef<HTMLDivElement>(null)
  // `beat` is which chapter is on screen; `local` is how far through it we are.
  const [beat, setBeat] = useState(0)
  const [local, setLocal] = useState(0)
  const total = copy.why.chapters.length

  useEffect(() => {
    const node = runwayRef.current
    if (!node) return

    let frame = 0
    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = node!.getBoundingClientRect()
        const scrollable = rect.height - window.innerHeight
        if (scrollable <= 0) return
        const progress = Math.min(Math.max(-rect.top / scrollable, 0), 0.9999)
        const scaled = progress * total
        setBeat(Math.floor(scaled))
        setLocal(scaled % 1)
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [total])

  const index = Math.min(beat, total - 1)
  const current = copy.why.chapters[index]
  // Beats hand over by cross-fading: the outgoing one is already invisible at
  // the boundary where its progress resets, so the swap is never seen. The
  // last beat does not fade out - the runway simply ends and it scrolls away.
  const isLast = index === total - 1
  const stageOpacity = Math.min(
    ramp(local, 0, START),
    isLast ? 1 : 1 - ramp(local, END + 0.07, 1),
  )

  return (
    <section id="why" className="relative bg-background">
      {/* The runway is its own box: the sticky chapter only occupies 100vh of
          flow, so anything sharing this box would ride up underneath it. */}
      <div ref={runwayRef} style={{ height: `${total * BEAT_VH}vh` }}>
        {/* Graph-paper ground, so the cards read as work being laid out on a page. */}
        <div
          className="sticky top-0 h-screen w-full overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)/0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.35) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        >
          <p className="absolute left-6 top-8 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            {copy.why.eyebrow}
          </p>

          {/* Scroll rail: an arrow that falls and resets, beside a vertical label. */}
          <div className="absolute left-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 sm:flex">
            <span className="relative block h-10 w-4">
              <ArrowDown className="absolute left-1/2 h-3.5 w-3.5 animate-scroll-arrow text-accent motion-reduce:animate-none" />
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 [writing-mode:vertical-rl]">
              {copy.why.scrollLabel}
            </span>
          </div>

          <div
            style={{ opacity: stageOpacity }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 motion-reduce:!opacity-100"
          >
            <div
              style={{ transform: `translateY(${(1 - ramp(local, 0, START + 0.04)) * 18}px)` }}
              className="text-center motion-reduce:!transform-none"
            >
              <h2 className="font-display text-3xl font-semibold text-primary sm:text-5xl">{current.title}</h2>
              <p className="mt-2 font-display text-xl sm:text-3xl">
                <span className="font-semibold text-primary">{current.lead} </span>
                <span className="italic text-primary/55">{current.emphasis}</span>
              </p>
            </div>

            {current.mode !== 'payoff' && (
              <p className="mb-5 mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3" />
                {current.caption}
              </p>
            )}

            <div className="flex min-h-[300px] w-full max-w-5xl items-center justify-center">
              {current.mode === 'payoff' ? (
                <div className="space-y-1 text-center">
                  {copy.why.payoff.map((line, i) => {
                    const [a, b] = slot(i, copy.why.payoff.length, 0.5)
                    const shown = ramp(local, a, b)
                    return (
                      <p
                        key={line.accent}
                        style={{ opacity: shown, transform: `translateY(${(1 - shown) * 20}px)` }}
                        className="font-display text-4xl font-semibold sm:text-6xl motion-reduce:!opacity-100 motion-reduce:!transform-none"
                      >
                        <span className="text-primary/70">{line.muted} </span>
                        <span className="italic text-accent">{line.accent}</span>
                      </p>
                    )
                  })}
                </div>
              ) : current.mode === 'routes' ? (
                <RadialRoutes copy={copy} progress={local} />
              ) : current.mode === 'hub' ? (
                <div className="flex flex-col items-center">
                  <ContextHub copy={copy} glow={ramp(local, START, START + 0.3)} />
                  <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                    {copy.why.contextPills.map((pill, i) => {
                      // Held back until the hub itself has settled.
                      const [a, b] = slot(i, copy.why.contextPills.length, 0.4, 0.3)
                      const shown = ramp(local, a, b)
                      return (
                        <span
                          key={pill}
                          style={{ opacity: shown, transform: `translateY(${(1 - shown) * 10}px)` }}
                          className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-primary motion-reduce:!opacity-100 motion-reduce:!transform-none"
                        >
                          {pill}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'flex w-full items-center justify-center',
                    // The "other AI" beat crowds the cards together: same work,
                    // stacked up, rather than laid out side by side.
                    current.mode === 'otherAi' ? 'gap-0 -space-x-6' : 'gap-2 sm:gap-3',
                  )}
                >
                  {(current.mode === 'single' ? copy.why.schools.slice(0, 1) : copy.why.schools).map(
                    (school, i, list) => (
                      <SchoolCard
                        key={school}
                        name={school}
                        mode={current.mode}
                        index={i}
                        count={list.length}
                        progress={local}
                      />
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Beat meter: a segment per chapter, the current one filling as you go. */}
            <div className="mt-10 flex items-center gap-1.5">
              {copy.why.chapters.map((chapter, i) => (
                <span key={chapter.mode} className="h-0.5 w-8 overflow-hidden rounded-full bg-muted-foreground/20">
                  <span
                    style={{ width: `${i < index ? 100 : i === index ? local * 100 : 0}%` }}
                    className="block h-full rounded-full bg-accent"
                  />
                </span>
              ))}
            </div>
          </div>

          <p className="absolute right-6 top-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
            {copy.why.axisLabel}
          </p>
        </div>
      </div>

      {/* The counting argument and the closer sit after the pinned run - no
          negative offset, or they ride up over the sticky chapter. */}
      <div className="relative mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <WorkloadChart copy={copy} />
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-12 rounded-2xl border bg-card p-6">
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
        <Reveal delay={200}>
          <p className="mt-12 text-center font-display text-2xl sm:text-3xl">
            {copy.why.closer.map((part) => (
              <span key={part.strong}>
                <span className="text-muted-foreground">{part.muted} </span>
                <span className="font-semibold text-primary">{part.strong} </span>
              </span>
            ))}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
