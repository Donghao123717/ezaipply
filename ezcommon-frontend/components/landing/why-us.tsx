"use client"
import { memo, useEffect, useRef, useState } from 'react'
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
/** Scroll progress is rounded to this many steps per beat before it reaches
 *  React, so scrolling does not re-render the chapter on every frame. */
const STEPS = 48

/**
 * Every beat's motion is scheduled inside this window. Leaving a margin at
 * each end gives the cross-fade somewhere to happen; running past END would
 * strand whatever is still animating when the beat flips.
 */
const START = 0.06
const END = 0.85

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

/** How long a beat's entrance takes, in milliseconds. */
const PLAY_MS = 2600

/**
 * A schedule written as beat fractions, handed to CSS as a delay and a
 * duration.
 *
 * Every beat used to be scrubbed - its graphic was a function of how far down
 * the runway the reader had scrolled - and then, briefly, of a clock in React
 * state. Both put the animation behind a React render: the first moved only
 * while the wheel moved, and the second moved at the rate the component
 * re-rendered, which was about eighteen frames a second and looked it.
 *
 * The schedules themselves were always static - `slot(i, n)` depends on an
 * index, not on scroll - so they belong in CSS, where the compositor runs them
 * at the display's rate and React renders each beat exactly once.
 */
function cue([from, to]: [number, number], scale = 1): React.CSSProperties {
  return {
    animationDelay: `${Math.round(from * PLAY_MS)}ms`,
    animationDuration: `${Math.max(Math.round((to - from) * PLAY_MS * scale), 120)}ms`,
  }
}

/** The moment a schedule finishes, for handing over to a perpetual animation. */
function after([, to]: [number, number]): string {
  return `${Math.round(to * PLAY_MS)}ms`
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
  carried,
}: {
  name: string
  mode: string
  index: number
  count: number
  /** How many of these cards were already on screen in the previous beat. */
  carried: number
}) {
  // Cards arrive one after another rather than all at once - but only the ones
  // that were not already here. Three consecutive beats show the same row of
  // applications and change only what is written on them; re-staggering the
  // whole row each time makes them blink out and march back in, which reads as
  // a new slide instead of the same desk being looked at again.
  const arriving = index >= carried
  const arrival = slot(index, count, 0.4)
  const rows = [0, 1, 2]

  return (
    // Two layers: the outer one is the entrance, the inner one drifts for ever
    // once the card has landed. Separating them is what lets a card keep
    // moving after its entrance has finished - one transform per element, and
    // a keyframe replaces an element's transform rather than adding to it.
    <div
      style={{ ...(arriving ? cue(arrival) : {}), zIndex: 10 - index }}
      className={cn(
        'w-[128px] shrink-0 sm:w-[150px] lg:w-[172px]',
        // A card the previous beat already had stays where it is. Re-staggering
        // the whole row each time makes them blink out and march back in.
        arriving && 'animate-beat-card motion-reduce:animate-none',
      )}
    >
    <div
      style={{ animationDelay: `${after(arrival)}`, willChange: 'transform' }}
      className="animate-card-breathe rounded-xl border bg-card p-3 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.45)] motion-reduce:animate-none"
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
            const fill = slot(index * 3 + row, count * 3, 0.22)
            // Both states are drawn, and the filled one fades in over the empty
            // one on cue. Swapping which is rendered needs React to be told
            // when; fading one over the other is a delay CSS already knows.
            return (
              <div key={row} className="relative flex items-center gap-1.5">
                <span className="relative flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border border-muted-foreground/30">
                  <span
                    style={{ animationDelay: after(fill), animationDuration: '260ms' }}
                    className="absolute inset-[-1px] flex animate-beat-fade items-center justify-center rounded-[3px] border border-primary bg-primary motion-reduce:animate-none"
                  >
                    <Check className="h-2 w-2 text-primary-foreground" />
                  </span>
                </span>
                <span className="relative h-1.5 flex-1 rounded-full bg-muted">
                  <span
                    style={{ animationDelay: after(fill), animationDuration: '260ms' }}
                    className="absolute inset-0 animate-beat-fade rounded-full bg-accent/40 motion-reduce:animate-none"
                  />
                </span>
                <PenLine
                  aria-hidden
                  style={cue(fill)}
                  className="absolute left-6 h-3 w-3 -translate-y-0.5 animate-beat-flash text-accent motion-reduce:hidden"
                />
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
    </div>
  )
}

/** The centre of the radial beats: one context card inside a breathing ring. */
function ContextHub({ copy, glow }: { copy: LandingCopy; glow?: [number, number] }) {
  const tints = [
    'bg-amber-50 text-amber-900 border-amber-200',
    'bg-emerald-50 text-emerald-900 border-emerald-200',
    'bg-sky-50 text-sky-900 border-sky-200',
    'bg-violet-50 text-violet-900 border-violet-200',
  ]
  return (
    <div className="relative flex h-[230px] w-[230px] items-center justify-center">
      <span aria-hidden className="absolute inset-0 rounded-full bg-accent/10 blur-2xl" />
      <span
        aria-hidden
        style={{ animationDelay: glow ? after(glow) : undefined, willChange: 'transform, opacity' }}
        className="absolute inset-2 animate-core-breathe rounded-full border border-accent/30 motion-reduce:animate-none"
      />
      <span
        aria-hidden
        style={{ animationDelay: glow ? after(glow) : undefined, willChange: 'transform' }}
        className="absolute inset-0 animate-core-spin rounded-full border border-dashed border-accent/25 opacity-80 motion-reduce:animate-none"
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
function RadialRoutes({ copy }: { copy: LandingCopy }) {
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
          const draw = slot(i, angles.length, 0.5)
          // Both states are drawn and cross-faded on cue: the solid route that
          // draws itself, and the dashed one that flows outward once it has.
          // Swapping which is rendered needs React to be told when; a delay is
          // something CSS already knows.
          return (
            <g key={angle}>
              <path
                d={d}
                fill="none"
                stroke="url(#why-route)"
                strokeWidth="1.6"
                pathLength={1}
                strokeDasharray={1}
                style={cue(draw)}
                className="animate-beat-draw motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
              />
              <path
                d={d}
                fill="none"
                stroke="url(#why-route)"
                strokeWidth="1.6"
                strokeDasharray="6 6"
                style={{ animationDelay: after(draw) }}
                className="animate-route-flow motion-reduce:animate-none"
              />
            </g>
          )
        })}
      </svg>

      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const leftPct = ((cx + Math.cos(rad) * radii.x) / 1000) * 100
        const topPct = ((cy + Math.sin(rad) * radii.y) / 500) * 100
        const draw = slot(i, angles.length, 0.5)
        // A node lights up as its own route lands, not on a separate clock.
        const arrive: [number, number] = [draw[0] + (draw[1] - draw[0]) * 0.75, draw[1] + 0.04]
        return (
          // Two nested elements: the outer one holds the position, the inner
          // one takes the pulse. A transform keyframe replaces an element's
          // own transform, so a node centred with a translate cannot also be
          // scaled by an animation without losing its place.
          <span
            key={angle}
            style={{ left: `${leftPct}%`, top: `${topPct}%`, ...cue(arrive) }}
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-beat-fade motion-reduce:animate-none"
          >
            <span
              style={{ animationDelay: after(arrive), willChange: 'transform' }}
              className="relative inline-flex animate-node-receive items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-[10px] font-medium text-primary shadow-sm motion-reduce:animate-none"
            >
              {/* The accent flash, as a ring fading in over the top. It was a
                  borderColor keyframe, which is a repaint the compositor
                  cannot take; opacity is one it can. */}
              <span
                aria-hidden
                style={{ animationDelay: after(arrive), willChange: 'opacity' }}
                className="pointer-events-none absolute inset-0 animate-node-ring rounded-lg border border-accent/55 motion-reduce:animate-none"
              />
              <SchoolLogo name={nodes[i] ?? ''} className="h-4 w-4 shrink-0" />
              {nodes[i]}
              <Check
                style={{ animationDelay: after(arrive), willChange: 'transform, opacity' }}
                className="h-2.5 w-2.5 animate-check-receive text-emerald-500 motion-reduce:animate-none"
              />
            </span>
          </span>
        )
      })}

      {/* The hub sits on top of the route origins. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ContextHub copy={copy} />
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

function WorkloadChart({ copy }: { copy: LandingCopy }) {
  // Axes settle, then the curves draw, then the crossings land, then the
  // labels. Reading order, in time - now expressed as CSS delays rather than
  // as numbers recomputed on every render.
  const frame: [number, number] = [START, START + 0.08]
  const draw: [number, number] = [START + 0.06, START + 0.46]

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-center">
      {/* What ten applications actually cost, counted out beside the curves. */}
      <div className="w-full shrink-0 lg:w-56">
        <p className="text-xs font-semibold text-primary">{copy.why.mathTitle}</p>
        <ul className="mt-3 space-y-2.5">
          {copy.why.math.map((item, i) => {
            return (
              <li
                key={item.bold}
                style={cue(slot(i, copy.why.math.length, 0.4, START + 0.12))}
                className="animate-beat-slide-x border-l-2 border-accent/40 pl-2.5 text-[11px] motion-reduce:animate-none"
              >
                <span className="font-semibold text-primary">{item.bold}</span>
                <span className="block text-muted-foreground">{item.rest}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div
        style={cue(frame)}
        className="w-full animate-beat-rise rounded-2xl border bg-card p-4 shadow-sm motion-reduce:animate-none sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {copy.why.chart.lines.map((line, i) => (
            <span key={line.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-0.5 w-5 rounded-full" style={{ background: CURVES[i].stroke, opacity: CURVES[i].opacity }} />
              {line.label}
            </span>
          ))}
        </div>

        <div className="relative">
        <svg viewBox="0 0 520 200" className="w-full" role="img" aria-label={copy.why.axisLabel}>
          <text x="40" y="16" className="fill-muted-foreground" fontSize="9">
            {copy.why.chart.yLabel}
          </text>

          <g style={cue(frame)} className="animate-beat-fade motion-reduce:animate-none">
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="40"
                x2="500"
                y1={30 + i * 44}
                y2={30 + i * 44}
                stroke="hsl(var(--border))"
                strokeOpacity={0.6}
              />
            ))}
            <line x1="40" y1="30" x2="40" y2="180" stroke="hsl(var(--border))" />
            <line x1="40" y1="180" x2="500" y2="180" stroke="hsl(var(--border))" />
          </g>

          {/* The fixed amount of work everything is measured against. */}
          <g style={cue(frame)} className="animate-beat-fade motion-reduce:animate-none">
            <line
              x1="40"
              y1={REF_Y}
              x2="500"
              y2={REF_Y}
              stroke="hsl(var(--accent))"
              strokeWidth="1"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />
            <text x="44" y={REF_Y - 6} className="fill-accent" fontSize="9" opacity={0.85}>
              {copy.why.chart.refLabel}
            </text>
          </g>

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
              style={cue(draw)}
              className="animate-beat-draw motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            />
          ))}

          {/* Once a curve is drawn, a light keeps running along it. A finished
              chart is otherwise a still picture, and a still picture is what
              made this section look stopped between scrolls. The dash is a
              short segment against a gap of the whole path, so exactly one
              streak travels at a time. */}
          {/* Only on our own curve. A stroke-dashoffset animation repaints the
              path every frame, and three of them repaint three paths to make
              one point that a single travelling light already makes. */}
          <path
            d={CURVES[2].d}
            fill="none"
            stroke={CURVES[2].stroke}
            strokeWidth={CURVES[2].width + 1.6}
            strokeOpacity={0.6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.07 0.93"
            style={{ animationDelay: after(draw) }}
            className="animate-trace-run motion-reduce:animate-none"
          />

          {/* Where each curve buys its last school. */}
          {CROSSINGS.map((cross, i) => {
            const land = slot(i, CROSSINGS.length, 0.3, START + 0.44)
            return (
              <circle
                key={cross.x}
                cx={cross.x}
                cy={REF_Y}
                r={4.5}
                fill={CURVES[i].stroke}
                fillOpacity={CURVES[i].opacity}
                stroke="hsl(var(--card))"
                strokeWidth="1.5"
                // Fades rather than pops: a transform on an SVG circle is not
                // something the compositor can take, and scaling three of them
                // laid the document out fifty times during the entrance. The
                // ping opening out of each marker carries the arrival instead.
                style={cue(land)}
                className="animate-beat-fade motion-reduce:animate-none"
              />
            )
          })}

          <text
            x="500"
            y="196"
            textAnchor="end"
            className="animate-beat-fade fill-muted-foreground motion-reduce:animate-none"
            fontSize="9"
            style={cue(frame)}
          >
            {copy.why.chart.xLabel}
          </text>
        </svg>

        {/* The pings that keep opening out of each crossing, the way a contact
            keeps repeating on a radar.

            Plain elements over the chart rather than circles inside it. A
            transform on an SVG circle is not something the compositor can
            take, so scaling one made the browser lay the whole document out
            again on every frame - a hundred and forty-five times a second,
            with nothing scrolling. Out here it is a layer of its own and costs
            nothing. */}
        {CROSSINGS.map((cross, i) => {
          const land = slot(i, CROSSINGS.length, 0.3, START + 0.44)
          return (
            <span
              key={`ping-${cross.x}`}
              aria-hidden
              style={{
                left: `${(cross.x / 520) * 100}%`,
                top: `${(REF_Y / 200) * 100}%`,
                background: CURVES[i].stroke,
                animationDelay: after(land),
                willChange: 'transform, opacity',
              }}
              className="pointer-events-none absolute h-2.5 w-2.5 animate-marker-breathe rounded-full motion-reduce:animate-none"
            />
          )
        })}
        </div>

        {/* One note per curve, held back until its crossing has landed. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {copy.why.chart.lines.map((line, i) => {
            return (
              <div
                key={line.key}
                style={cue(slot(i, copy.why.chart.lines.length, 0.3, START + 0.56))}
                className={cn(
                  'animate-beat-rise rounded-lg border px-2.5 py-1.5 motion-reduce:animate-none',
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
 * The incoming beat is held at zero until the hand-over starts, so everything
 * inside it sits at its entry pose while it fades up and only starts moving
 * once the beat is its turn.
 */
const BeatStage = memo(function BeatStage({
  copy,
  current,
  leaving,
  carried,
}: {
  copy: LandingCopy
  current: LandingCopy['why']['chapters'][number]
  /** The beat being scrolled away from, fading out under the incoming one. */
  leaving: boolean
  carried: number
}) {
  return (
    // The hand-over is a CSS transition, not a number recomputed per scroll
    // frame. Driven from scroll it only had as many steps as the scroll
    // position was quantised to - about eight across the whole dissolve - and
    // a fade in eight steps is a fade you can count.
    <div
      aria-hidden={leaving}
      style={{ willChange: 'opacity' }}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-700 ease-out motion-reduce:transition-none',
        leaving ? 'z-0 opacity-0' : 'z-10 opacity-100',
      )}
    >
          {/* The payoff beat is the three lines and nothing else - a heading
              above them would only say what they already say. */}
          {current.mode !== 'payoff' && (
            <div style={cue([0, START + 0.1])} className="animate-beat-rise text-center motion-reduce:animate-none">
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
                  return (
                    <p
                      key={line.accent}
                      style={cue(slot(i, copy.why.payoff.length, 0.5))}
                      className="animate-beat-rise font-display text-4xl font-semibold motion-reduce:animate-none sm:text-6xl"
                    >
                      <span className="text-primary/70">{line.muted} </span>
                      {/* The accent word keeps a light passing over it, so the
                          closing frame is not three lines of dead type. */}
                      <span
                        style={{
                          animationDelay: `${i * 0.7}s`,
                          backgroundImage:
                            'linear-gradient(100deg, hsl(var(--accent)) 38%, hsl(var(--accent)/0.45) 50%, hsl(var(--accent)) 62%)',
                          backgroundSize: '260% 100%',
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          color: 'transparent',
                        }}
                        className="animate-accent-sweep italic motion-reduce:animate-none motion-reduce:!text-accent"
                      >
                        {line.accent}
                      </span>
                    </p>
                  )
                })}
              </div>
            ) : current.mode === 'chart' ? (
              <WorkloadChart copy={copy} />
            ) : current.mode === 'routes' ? (
              <RadialRoutes copy={copy} />
            ) : current.mode === 'hub' ? (
              <div className="flex flex-col items-center">
                <ContextHub copy={copy} glow={[START, START + 0.3]} />
                <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                  {copy.why.contextPills.map((pill, i) => {
                    // Held back until the hub itself has settled.
                    return (
                      <span
                        key={pill}
                        style={cue(slot(i, copy.why.contextPills.length, 0.4, 0.3))}
                        className="animate-beat-rise rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-primary motion-reduce:animate-none"
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
                      carried={carried}
                    />
                  ),
                )}
              </div>
            )}
          </div>
    </div>
  )
})

export function WhyUs({ copy }: { copy: LandingCopy }) {
  const runwayRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Beats run on a clock now, so they would keep animating after the reader
  // has scrolled past. They stop when the stage leaves the screen.
  const [visible, setVisible] = useState(false)
  // `beat` is which chapter is on screen; `local` is how far through it we are.
  const [beat, setBeat] = useState(0)
  const [local, setLocal] = useState(0)
  const total = copy.why.chapters.length

  useEffect(() => {
    const node = runwayRef.current
    if (!node) return

    let frame = 0
    // Measured once rather than per frame: a getBoundingClientRect() inside a
    // scroll handler forces the browser to lay the page out again before it
    // can answer, sixty times a second, on a document nine screens tall.
    let runwayTop = 0
    let scrollable = 0

    function measure() {
      const rect = node!.getBoundingClientRect()
      runwayTop = rect.top + window.scrollY
      scrollable = rect.height - window.innerHeight
    }

    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (scrollable <= 0) return
        const progress = Math.min(Math.max((window.scrollY - runwayTop) / scrollable, 0), 0.9999)
        const scaled = progress * total
        setBeat(Math.floor(scaled))
        // Quantised to 1/STEPS. The raw float changes every single frame, and
        // every change re-rendered the whole chapter; at this step the largest
        // move it can hide is a third of a pixel and two percent of an opacity,
        // so nothing is visibly lost and most frames do no React work at all.
        const next = Math.round((scaled % 1) * STEPS) / STEPS
        setLocal((prev) => (prev === next ? prev : next))
      })
    }

    function remeasure() {
      measure()
      onScroll()
    }

    measure()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasure)
      cancelAnimationFrame(frame)
    }
  }, [total])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const index = Math.min(beat, total - 1)
  const current = copy.why.chapters[index]

  /**
   * The beat being scrolled away from, kept mounted just long enough to fade
   * out under the incoming one.
   *
   * Beats hand over by dissolving rather than cutting: a frame of empty stage
   * between them reads as a slide change. The outgoing beat keeps its own DOM
   * node - it is keyed by chapter - so flipping one class runs the fade as a
   * CSS transition at the display's rate, whatever the scroll is doing.
   */
  const [shown, setShown] = useState<{ cur: number; prev: number | null }>({ cur: 0, prev: null })

  // Derived during the render that changes the beat, not afterwards in an
  // effect. An effect commits one render too late: React would have already
  // unmounted the outgoing beat, and a node that is mounted fresh at zero
  // opacity does not transition - it is simply absent. Keeping it in the same
  // commit means its node survives and only its class changes, which is what
  // the browser needs to animate between the two.
  if (shown.cur !== index) {
    setShown({ cur: index, prev: shown.cur })
  }

  useEffect(() => {
    if (shown.prev === null) return
    const timer = setTimeout(() => setShown((s) => ({ ...s, prev: null })), 700)
    return () => clearTimeout(timer)
  }, [shown])

  const leaving = shown.prev
  const leavingChapter = leaving !== null && leaving !== index ? copy.why.chapters[leaving] : null

  return (
    <section id="why" className="relative bg-background">
      {/* The runway is its own box: the sticky chapter only occupies 100vh of
          flow, so anything sharing this box would ride up underneath it. */}
      <div ref={runwayRef} style={{ height: `${total * BEAT_VH}vh` }}>
        {/* Graph-paper ground, so the cards read as work being laid out on a page. */}
        {/* --ambient-play gates every infinite animation inside the stage, so
            the story's perpetual layer stops the moment it is scrolled past
            rather than ticking for the rest of the page. */}
        <div
          ref={stageRef}
          className="sticky top-0 h-screen w-full overflow-hidden"
          style={{
            ['--ambient-play' as string]: visible ? 'running' : 'paused',
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

          {/* Keyed on the chapter, so arriving at a beat mounts it and its
              entrance plays once - and so the beat being left keeps the node
              it already had and can simply fade. */}
          {leavingChapter && (
            <BeatStage
              key={leavingChapter.mode}
              copy={copy}
              current={leavingChapter}
              leaving
              carried={carriedInto(copy, leaving!)}
            />
          )}
          <BeatStage
            key={current.mode}
            copy={copy}
            current={current}
            leaving={false}
            carried={carriedInto(copy, index)}
          />

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
