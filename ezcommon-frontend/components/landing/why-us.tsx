"use client"
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Check, Loader2, PenLine, RotateCcw } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
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

/**
 * How much of a beat the hand-over occupies. Long enough that the two beats
 * are visibly on screen together - which is the point - and short enough that
 * the reader is not looking at a double exposure for most of the scroll.
 */
const OVERLAP = 0.16

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

/** Beats that put the same row of application cards on the desk. */
const CARD_MODES = ['single', 'manual', 'otherAi']

/** How many cards the previous beat left standing, so this one can keep them. */
function carriedInto(copy: LandingCopy, index: number): number {
  const previous = copy.why.chapters[index - 1]
  const current = copy.why.chapters[index]
  if (!previous || !CARD_MODES.includes(previous.mode) || !CARD_MODES.includes(current.mode)) return 0
  return previous.mode === 'single' ? 1 : copy.why.schools.length
}

/** A school's application card, drawn differently per beat. */
function SchoolCard({
  name,
  mode,
  index,
  count,
  progress,
  carried,
}: {
  name: string
  mode: string
  index: number
  count: number
  progress: number
  /** How many of these cards were already on screen in the previous beat. */
  carried: number
}) {
  // Cards arrive one after another rather than all at once - but only the ones
  // that were not already here. Three consecutive beats show the same row of
  // applications and change only what is written on them; re-staggering the
  // whole row each time makes them blink out and march back in, which reads as
  // a new slide instead of the same desk being looked at again.
  const [cardIn, cardOut] = slot(index, count, 0.4)
  const arrival = index < carried ? 1 : ramp(progress, cardIn, cardOut)
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

/**
 * The closing argument, drawn rather than asserted.
 *
 * Three curves against one horizontal line. The line is a fixed amount of
 * work; where each curve crosses it is how many schools that much work buys
 * you. Manual crosses first and keeps climbing, another AI tool crosses a
 * little later, and Aipply runs flat along the line and never crosses - which
 * is the whole claim in one shape, and the reason this is a chart and not a
 * bullet list.
 *
 * Scrubbed by scroll rather than run on mount. A chart that animates on mount
 * inside a pinned stage has already finished by the time the reader reaches
 * its beat, so they only ever see the final frame - which is exactly what was
 * happening before.
 */

const REF_Y = 120

/** Where each curve meets the workload line, and what to say about it. */
const CROSSINGS = [
  { x: 152, tone: 'muted' as const },
  { x: 258, tone: 'primary' as const },
  { x: 474, tone: 'accent' as const },
]

const CURVES = [
  // Manual: climbs and never stops climbing.
  { d: 'M40 172 C 92 162, 124 142, 152 120 S 372 54, 480 30', stroke: 'hsl(var(--muted-foreground))', width: 2, opacity: 1 },
  // Another AI tool: the same shape, shifted right. Faster, not different.
  { d: 'M40 174 C 128 170, 206 146, 258 120 S 404 82, 480 60', stroke: 'hsl(var(--primary))', width: 2, opacity: 0.55 },
  // Aipply: rises once, then runs along the line.
  { d: 'M40 172 C 74 150, 116 126, 168 121 C 268 118, 380 118, 480 118', stroke: 'hsl(var(--accent))', width: 2.75, opacity: 1 },
]

function WorkloadChart({ copy, progress }: { copy: LandingCopy; progress: number }) {
  // Axes settle, then the curves draw, then the crossings land, then the
  // labels. Reading order, in time.
  const frame = ramp(progress, START, START + 0.08)
  const draw = ramp(progress, START + 0.06, START + 0.46)

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-center">
      {/* What ten applications actually cost, counted out beside the curves. */}
      <div className="w-full shrink-0 lg:w-56">
        <p className="text-xs font-semibold text-primary">{copy.why.mathTitle}</p>
        <ul className="mt-3 space-y-2.5">
          {copy.why.math.map((item, i) => {
            const [a, b] = slot(i, copy.why.math.length, 0.4, START + 0.12)
            const shown = ramp(progress, a, b)
            return (
              <li
                key={item.bold}
                style={{ opacity: shown, transform: `translateX(${(1 - shown) * -10}px)` }}
                className="border-l-2 border-accent/40 pl-2.5 text-[11px] motion-reduce:!opacity-100 motion-reduce:!transform-none"
              >
                <span className="font-semibold text-primary">{item.bold}</span>
                <span className="block text-muted-foreground">{item.rest}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div
        style={{ opacity: frame, transform: `translateY(${(1 - frame) * 12}px)` }}
        className="w-full rounded-2xl border bg-card p-4 shadow-sm motion-reduce:!opacity-100 motion-reduce:!transform-none sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {copy.why.chart.lines.map((line, i) => (
            <span key={line.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-0.5 w-5 rounded-full" style={{ background: CURVES[i].stroke, opacity: CURVES[i].opacity }} />
              {line.label}
            </span>
          ))}
        </div>

        <svg viewBox="0 0 520 200" className="w-full" role="img" aria-label={copy.why.axisLabel}>
          <text x="40" y="16" className="fill-muted-foreground" fontSize="9">
            {copy.why.chart.yLabel}
          </text>

          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1="40"
              x2="500"
              y1={30 + i * 44}
              y2={30 + i * 44}
              stroke="hsl(var(--border))"
              strokeOpacity={0.6 * frame}
            />
          ))}
          <line x1="40" y1="30" x2="40" y2="180" stroke="hsl(var(--border))" strokeOpacity={frame} />
          <line x1="40" y1="180" x2="500" y2="180" stroke="hsl(var(--border))" strokeOpacity={frame} />

          {/* The fixed amount of work everything is measured against. */}
          <line
            x1="40"
            y1={REF_Y}
            x2="500"
            y2={REF_Y}
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity={0.55 * frame}
          />
          <text x="44" y={REF_Y - 6} className="fill-accent" fontSize="9" opacity={0.85 * frame}>
            {copy.why.chart.refLabel}
          </text>

          {CURVES.map((curve, i) => (
            <path
              key={i}
              d={curve.d}
              fill="none"
              stroke={curve.stroke}
              strokeWidth={curve.width}
              strokeOpacity={curve.opacity}
              strokeLinecap="round"
              // pathLength normalises the curve to 1 so the same offset draws
              // every path at the same rate, whatever its real length.
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - draw}
            />
          ))}

          {/* Where each curve buys its last school. */}
          {CROSSINGS.map((cross, i) => {
            const [a, b] = slot(i, CROSSINGS.length, 0.3, START + 0.44)
            const pop = ramp(progress, a, b)
            return (
              <circle
                key={cross.x}
                cx={cross.x}
                cy={REF_Y}
                r={4.5 * pop}
                fill={CURVES[i].stroke}
                fillOpacity={CURVES[i].opacity}
                stroke="hsl(var(--card))"
                strokeWidth="1.5"
              />
            )
          })}

          <text x="500" y="196" textAnchor="end" className="fill-muted-foreground" fontSize="9" opacity={frame}>
            {copy.why.chart.xLabel}
          </text>
        </svg>

        {/* One note per curve, held back until its crossing has landed. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {copy.why.chart.lines.map((line, i) => {
            const [a, b] = slot(i, copy.why.chart.lines.length, 0.3, START + 0.56)
            const shown = ramp(progress, a, b)
            return (
              <div
                key={line.key}
                style={{ opacity: shown, transform: `translateY(${(1 - shown) * 8}px)` }}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 motion-reduce:!opacity-100 motion-reduce:!transform-none',
                  line.key === 'aipply' ? 'border-accent/45 bg-accent/5' : 'bg-background',
                )}
              >
                <p className={cn('text-[11px] font-semibold', line.key === 'aipply' ? 'text-accent' : 'text-primary')}>
                  {line.label}
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">{line.note}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * One beat of the run, drawn at its own opacity.
 *
 * Split out so two can be on screen at once. Fading one beat to zero and the
 * next up from zero leaves a frame of empty stage between every beat, and a
 * reader reads that blink as a slide change. Overlapping them dissolves one
 * into the other instead, which is what makes a scrubbed run feel like one
 * continuous thing rather than six separate screens.
 *
 * The incoming beat is handed a negative `local`, so everything scheduled
 * inside it sits at its entry pose while it fades up and only starts moving
 * once the beat is its turn.
 */
function BeatStage({
  copy,
  current,
  local,
  alpha,
  carried,
}: {
  copy: LandingCopy
  current: LandingCopy['why']['chapters'][number]
  local: number
  alpha: number
  carried: number
}) {
  if (alpha <= 0.002) return null
  return (
    <div
      aria-hidden={alpha < 0.5}
      style={{ opacity: alpha }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 motion-reduce:!opacity-100"
    >
          {/* The payoff beat is the three lines and nothing else - a heading
              above them would only say what they already say. */}
          {current.mode !== 'payoff' && (
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
          )}

          {current.mode !== 'payoff' && current.mode !== 'chart' && (
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
            ) : current.mode === 'chart' ? (
              <WorkloadChart copy={copy} progress={local} />
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
              <div className="flex w-full items-center justify-center gap-2 sm:gap-3">
                {/* Spacing is the same in every card beat on purpose. Three
                    consecutive beats dissolve into one another here, and two
                    layers only dissolve cleanly if what is being dissolved sits
                    in the same place in both - re-spacing the row for one beat
                    turned the hand-over into a double image. What changes
                    between these beats is what is written on the cards, which
                    is the argument anyway. */}
                {(current.mode === 'single' ? copy.why.schools.slice(0, 1) : copy.why.schools).map(
                  (school, i, list) => (
                    <SchoolCard
                      key={school}
                      name={school}
                      mode={current.mode}
                      index={i}
                      count={list.length}
                      progress={local}
                      carried={carried}
                    />
                  ),
                )}
              </div>
            )}
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
  const nextChapter = isLast ? null : copy.why.chapters[index + 1]
  // The dissolve: over the last OVERLAP of a beat the outgoing one falls away
  // while the incoming one rises, both on screen together. The first beat
  // still fades up from nothing, because there is nothing behind it.
  const handover = ramp(local, 1 - OVERLAP, 1)
  const currentAlpha = Math.min(index === 0 ? ramp(local, 0, START) : 1, isLast ? 1 : 1 - handover)
  const nextAlpha = nextChapter ? handover : 0

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

          {/* The outgoing beat stays on screen while the next fades up over
              it, so a hand-over is a dissolve rather than a cut. */}
          <BeatStage
            copy={copy}
            current={current}
            local={local}
            alpha={currentAlpha}
            carried={carriedInto(copy, index)}
          />
          {nextChapter && (
            <BeatStage
              copy={copy}
              current={nextChapter}
              local={local - 1}
              alpha={nextAlpha}
              carried={carriedInto(copy, index + 1)}
            />
          )}

          {/* The meter belongs to the run, not to a beat, so it never fades. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-6">
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

    </section>
  )
}
