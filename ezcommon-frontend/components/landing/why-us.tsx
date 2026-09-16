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

/**
 * The scale story's surfaces, taken from the reference page's own computed
 * styles rather than guessed at.
 *
 * Their cards read as paper on a desk: a warm off-white a shade lighter than
 * the page, a hairline of the ink colour at a tenth opacity rather than a grey
 * border, and a shadow that is tinted navy and thrown a long way with no
 * spread. Ours were flatter, greyer and much tighter-cornered, which is most
 * of why the same layout looked cheaper.
 */
const CARD_SURFACE =
  'border border-primary/10 bg-[hsl(36_50%_99%)] shadow-[0_24px_80px_-28px_hsl(var(--primary)/0.30)]'
const NODE_SURFACE =
  'border border-primary/10 bg-[hsl(36_50%_99%)] shadow-[0_12px_30px_-12px_hsl(var(--primary)/0.28)]'
/** The row pills inside an application card: 50px tall, barely-there cream. */
const ROW_SURFACE = 'bg-[hsl(38_38%_97%)]'

/**
 * Where each card in the overload swarm ends up, as a stable pseudo-random
 * scatter.
 *
 * Deterministic on purpose - `Math.random()` here would give the server one
 * layout and the client another, and React would throw the markup away and
 * rebuild it on hydration. A hash of the index gives the same jumble every
 * time, on both sides.
 */
const SWARM_HOLE = { x: 190, y: 96 }

function swarmSpot(index: number, count: number): { x: number; y: number; delay: number } {
  const columns = 6
  const column = index % columns
  const row = Math.floor(index / columns)
  const rows = Math.ceil(count / columns)
  // A cheap deterministic hash, so the grid reads as a scatter rather than a table.
  const jitter = (seed: number) => (((seed * 2654435761) % 1000) / 1000 - 0.5) * 2
  let x = (column - (columns - 1) / 2) * 176 + jitter(index + 1) * 44
  let y = (row - (rows - 1) / 2) * 128 + jitter(index + 17) * 30

  // Keep the middle clear for the count. Without this the number is read
  // through four overlapping cards, which is the one thing on this beat that
  // has to stay legible.
  if (Math.abs(x) < SWARM_HOLE.x && Math.abs(y) < SWARM_HOLE.y) {
    const push = SWARM_HOLE.x + 40
    x = x >= 0 ? push : -push
  }
  return { x, y, delay: index * 42 }
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
  // One school on its own is the hero of its beat and is drawn at full size;
  // the row of five shares the stage and is drawn smaller.
  const solo = mode === 'single'
  const rows = [0, 1, 2]

  return (
    // Two layers: the outer one is the entrance, the inner one drifts for ever
    // once the card has landed. Separating them is what lets a card keep
    // moving after its entrance has finished - one transform per element, and
    // a keyframe replaces an element's transform rather than adding to it.
    <div
      style={{ ...(arriving ? cue(arrival) : {}), zIndex: 10 - index }}
      className={cn(
        'shrink-0',
        solo ? 'w-[300px] sm:w-[360px]' : 'w-[150px] sm:w-[178px] lg:w-[196px]',
        arriving && 'animate-beat-card motion-reduce:animate-none',
      )}
    >
      <div
        style={{ animationDelay: after(arrival), willChange: 'transform' }}
        className={cn(
          'animate-card-breathe motion-reduce:animate-none',
          CARD_SURFACE,
          solo ? 'rounded-[26px] p-6' : 'rounded-2xl p-4',
        )}
      >
        <div className={cn('flex items-center', solo ? 'gap-3.5' : 'gap-2.5')}>
          {/* The logo sits in a bordered tile rather than loose on the card -
              it is what stops a dozen different institutional marks, each with
              its own shape and weight, from making the row look ragged. */}
          <span
            className={cn(
              'flex shrink-0 items-center justify-center border border-primary/10 bg-card',
              solo ? 'h-14 w-14 rounded-2xl' : 'h-9 w-9 rounded-xl',
            )}
          >
            <SchoolLogo name={name} className={solo ? 'h-8 w-8' : 'h-5 w-5'} />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'truncate font-semibold tracking-tight text-primary',
                solo ? 'text-xl' : 'text-[13px]',
              )}
            >
              {name}
            </p>
            <p className={cn('text-muted-foreground', solo ? 'mt-0.5 text-sm' : 'text-[10px]')}>
              {mode === 'otherAi' ? 'new session' : 'Application'}
            </p>
          </div>
        </div>

        <div className={cn(solo ? 'mt-5 space-y-2.5' : 'mt-3.5 space-y-2')}>
          {mode === 'otherAi' ? (
            <div className={cn('flex flex-col items-center justify-center gap-2', solo ? 'py-10' : 'py-7')}>
              <Loader2 className="h-5 w-5 animate-spin text-primary/35 motion-reduce:animate-none" />
              <span className="text-[10px] text-muted-foreground">starting over</span>
            </div>
          ) : (
            rows.map((row) => {
              // Each row is filled in turn, and the pen sits on the row being
              // written. Rows share one schedule across every card, so the last
              // card's last row still lands inside the beat.
              const fill = slot(index * 3 + row, count * 3, 0.22)
              // Both states are drawn, and the filled one fades in over the
              // empty one on cue. Swapping which is rendered needs React to be
              // told when; fading one over the other is a delay CSS knows.
              return (
                <div
                  key={row}
                  className={cn(
                    'relative flex items-center rounded-lg',
                    ROW_SURFACE,
                    solo ? 'gap-3 px-3.5 py-3.5' : 'gap-2 px-2.5 py-2.5',
                  )}
                >
                  <span
                    className={cn(
                      'relative flex shrink-0 items-center justify-center rounded-md border border-primary/20',
                      solo ? 'h-6 w-6' : 'h-4 w-4',
                    )}
                  >
                    <span
                      style={{ animationDelay: after(fill), animationDuration: '260ms' }}
                      className="absolute inset-[-1px] flex animate-beat-fade items-center justify-center rounded-md bg-primary motion-reduce:animate-none"
                    >
                      <Check className={cn('text-primary-foreground', solo ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className={cn('block rounded-full bg-primary/10', solo ? 'h-2' : 'h-1.5')} />
                    <span className={cn('block w-2/3 rounded-full bg-primary/10', solo ? 'h-2' : 'h-1.5')} />
                  </span>
                  <PenLine
                    aria-hidden
                    style={cue(fill)}
                    className={cn(
                      'absolute animate-beat-flash text-accent motion-reduce:hidden',
                      solo ? 'left-9 h-4 w-4' : 'left-7 h-3 w-3',
                    )}
                  />
                </div>
              )
            })
          )}
        </div>

        {mode === 'manual' && (
          <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
            <RotateCcw className="h-2.5 w-2.5" />
            from zero
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The overload beat: every school thrown outward from the middle, counting up
 * as they land - and, on the beat after, gathered back into one.
 *
 * This is the shape the argument needs and the page did not have. A row of
 * five cards says "several applications"; twenty-two thrown out of the centre
 * says "this does not stop", which is the claim. Gathering the same pile back
 * into the hub is the answer to it, and the two only read as one idea because
 * the cards fly out to, and come back from, exactly the same places.
 */
function SchoolSwarm({
  copy,
  gathering,
}: {
  copy: LandingCopy
  /** Reverse: the pile converges into the hub instead of flying out of it. */
  gathering?: boolean
}) {
  const schools = copy.why.swarmSchools
  const count = schools.length
  // The counter runs while the cards are still landing, so the number and the
  // pile grow together.
  const steps = [3, 6, 9, 12, count]

  return (
    // The scatter is laid out in pixels around a centre, so on a narrow screen
    // it is scaled rather than re-flowed: the pile keeps its shape and the
    // cards keep their proportions, and one transform on the wrapper is
    // cheaper than sixteen recalculated positions.
    <div className="pointer-events-none absolute inset-0 flex scale-[0.42] items-center justify-center sm:scale-[0.62] lg:scale-100">
      {schools.map((school, i) => {
        const spot = swarmSpot(i, count)
        const flight = gathering
          ? { animationDelay: `${600 + (count - 1 - i) * 34}ms`, animationDuration: '760ms' }
          : { animationDelay: `${spot.delay}ms`, animationDuration: '820ms' }
        return (
          <span
            key={`${school}-${i}`}
            // No explicit will-change: an element animating transform and
            // opacity is promoted for the length of its animation anyway, and
            // pinning a layer on every card in the pile costs more to set up
            // and tear down than it saves.
            style={{
              ['--fx' as string]: `${spot.x}px`,
              ['--fy' as string]: `${spot.y}px`,
              ...flight,
            }}
            className={cn(
              'absolute z-0 w-[164px] rounded-xl px-3 py-2.5',
              NODE_SURFACE,
              gathering ? 'animate-swarm-in' : 'animate-swarm-out',
              'motion-reduce:animate-none motion-reduce:hidden',
            )}
          >
            <span className="flex items-center gap-2">
              <SchoolLogo name={school} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-tight text-primary">
                {school}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
            </span>
            {/* The work still waiting on each one. A name alone reads as a tag;
                what makes the pile feel heavy is that every card has a form
                under it. Left off the gathering pass - nobody reads two grey
                lines on a card that is in flight and fading, and the pile is
                built twice across the two beats. */}
            {!gathering && (
              <span className="mt-2 block space-y-1">
                <span className="block h-1 rounded-full bg-primary/10" />
                <span className="block h-1 w-2/3 rounded-full bg-primary/10" />
              </span>
            )}
          </span>
        )
      })}

      {!gathering && (
        // The count, stacked rather than computed: each number fades over the
        // one before it on its own delay, which keeps a counter that appears to
        // run off the main thread entirely.
        <span className="relative z-10 flex flex-col items-center">
          <span className="relative block h-[86px] w-[170px]">
            {steps.map((value, i) => {
              const last = i === steps.length - 1
              // Each number is on screen only for its own slice: they are
              // stacked, so one that fades in and stays leaves every earlier
              // number printed underneath it. Only the final count holds.
              return (
                <span
                  key={value}
                  style={{
                    animationDelay: `${260 + i * 300}ms`,
                    animationDuration: last ? '260ms' : '320ms',
                  }}
                  className={cn(
                    'absolute inset-0 flex items-center justify-center font-display text-[80px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[hsl(207_56%_42%)] motion-reduce:animate-none',
                    last ? 'animate-beat-fade' : 'animate-beat-flash',
                  )}
                >
                  {String(value).padStart(2, '0')}
                </span>
              )
            })}
          </span>
          <span
            style={{ animationDelay: '360ms', animationDuration: '400ms' }}
            className="animate-beat-fade text-[13px] font-medium text-muted-foreground motion-reduce:animate-none"
          >
            {copy.why.swarmCaption}
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * The centre of the radial beats: the one reusable context, inside a ball.
 *
 * Drawn at the size the reference draws it. Ours was a 150px thumbnail with
 * 8px type, which made the thing the whole argument turns on the smallest
 * object on the screen - it read as a stray tooltip rather than as the answer
 * the swarm is collapsing into.
 */
function ContextHub({
  copy,
  glow,
  gathering,
}: {
  copy: LandingCopy
  glow?: [number, number]
  /** Swell as the swarm arrives, instead of simply being there. */
  gathering?: boolean
}) {
  const tints = [
    'bg-amber-50/90 text-amber-900 border-amber-200/70',
    'bg-emerald-50/90 text-emerald-900 border-emerald-200/70',
    'bg-sky-50/90 text-sky-900 border-sky-200/70',
    'bg-violet-50/90 text-violet-900 border-violet-200/70',
  ]
  const delay = glow ? after(glow) : undefined

  return (
    <div
      style={gathering ? { animationDelay: '900ms', animationDuration: '900ms', willChange: 'transform, opacity' } : undefined}
      className={cn(
        'relative flex h-[330px] w-[330px] items-center justify-center',
        gathering && 'animate-hub-gather motion-reduce:animate-none',
      )}
    >
      {/* The ball: a soft body, a breathing halo, and a slow dashed orbit. */}
      <span
        aria-hidden
        style={{ animationDelay: delay, willChange: 'transform, opacity' }}
        className="absolute inset-0 animate-hub-halo rounded-full bg-accent/15 blur-2xl motion-reduce:animate-none"
      />
      <span
        aria-hidden
        className="absolute inset-4 rounded-full border border-accent/25 bg-[hsl(36_50%_99%)]/70"
      />
      <span
        aria-hidden
        style={{ animationDelay: delay, willChange: 'transform, opacity' }}
        className="absolute inset-8 animate-core-breathe rounded-full border border-accent/35 motion-reduce:animate-none"
      />
      <span
        aria-hidden
        style={{ animationDelay: delay, willChange: 'transform' }}
        className="absolute inset-0 animate-core-spin rounded-full border border-dashed border-accent/30 opacity-80 motion-reduce:animate-none"
      />

      <div
        className={cn(
          'relative w-[232px] rounded-[20px] p-4',
          CARD_SURFACE,
        )}
      >
        <p className="mb-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">Ai</span>
          {copy.why.hubLabel}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {copy.why.contextPills.map((pill, i) => (
            <span
              key={pill}
              className={cn(
                'rounded-xl border px-2.5 py-3 text-[11px] font-semibold leading-tight',
                tints[i % tints.length],
              )}
            >
              {pill}
              <span className="mt-1.5 block h-1 w-8 rounded-full bg-current opacity-25" />
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
      {/* What ten applications actually cost, counted out beside the curves.
          Hidden on a phone: beside the chart it is a margin note, but stacked
          above it on a narrow screen it pushed the chart - and the heading -
          off a stage that is exactly one screen tall. */}
      <div className="hidden w-full shrink-0 lg:block lg:w-56">
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
/**
 * `waiting` is a beat that has been built but not started.
 *
 * Building one costs real time - the overload beat alone is twenty-two cards,
 * each with a logo - and paying it at the moment the reader crosses into that
 * beat put a sixty-millisecond task in the middle of a scroll, which is a
 * dropped frame exactly where the eye is. So the next beat is mounted a beat
 * early with its animations paused: `both` fill holds every element at its
 * opening pose, and letting them run is one custom property away.
 */
type BeatState = 'current' | 'leaving' | 'waiting'

const BeatStage = memo(function BeatStage({
  copy,
  current,
  state,
  carried,
}: {
  copy: LandingCopy
  current: LandingCopy['why']['chapters'][number]
  state: BeatState
  carried: number
}) {
  return (
    // The hand-over is a CSS transition, not a number recomputed per scroll
    // frame. Driven from scroll it only had as many steps as the scroll
    // position was quantised to - about eight across the whole dissolve - and
    // a fade in eight steps is a fade you can count.
    <div
      aria-hidden={state !== 'current'}
      style={{
        willChange: 'opacity',
        // Overrides the stage-wide value for this subtree only, which is what
        // holds a pre-built beat still until it is the one being read.
        ...(state === 'waiting' ? { ['--ambient-play' as string]: 'paused' } : {}),
      }}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center px-6',
        state === 'current' && 'z-10 opacity-100',
        // Only the beat being left animates its opacity. A waiting one is
        // simply not drawn, and a current one is already being faded in by its
        // own contents.
        state === 'leaving' && 'z-0 opacity-0 transition-opacity duration-700 ease-out motion-reduce:transition-none',
        state === 'waiting' && 'z-0 opacity-0',
      )}
    >
          {/* The payoff beat is the three lines and nothing else - a heading
              above them would only say what they already say. */}
          {current.mode !== 'payoff' && (
            <div style={cue([0, START + 0.1])} className="animate-beat-rise text-center motion-reduce:animate-none">
              {/* Sized off the reference: 54px, weight 650, tracking pulled in
                  hard and leading set to the type size. Ours was 48px at normal
                  tracking with loose leading, which is the difference between a
                  title and a headline. */}
              <h2 className="font-display text-[34px] font-semibold leading-none tracking-[-0.045em] text-primary sm:text-[54px] sm:tracking-[-0.055em]">
                {current.title}
              </h2>
              <p className="mt-3 font-display text-[22px] leading-tight tracking-[-0.03em] sm:text-[34px]">
                <span className="font-semibold text-primary">{current.lead} </span>
                <span className="italic text-primary/50">{current.emphasis}</span>
              </p>
            </div>
          )}

          {current.mode !== 'payoff' && current.mode !== 'chart' && (
            <p className="mb-6 mt-7 flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCcw className="h-3 w-3" />
              {current.caption}
            </p>
          )}

          <div className="flex min-h-[340px] w-full max-w-5xl items-center justify-center">
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
            ) : current.mode === 'swarm' ? (
              // Scaled down on a narrow screen, so it needs less room there
              // too - at full height it pushed the heading up under the site
              // header.
              <div className="relative h-[230px] w-full sm:h-[330px] lg:h-[460px]">
                <SchoolSwarm copy={copy} />
              </div>
            ) : current.mode === 'hub' ? (
              <div className="relative flex flex-col items-center">
                {/* The same pile, in reverse: it converges on the hub while the
                    hub swells to take it. The two beats only read as one idea
                    because the cards come back from exactly where they went. */}
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[230px] -translate-y-1/2 sm:h-[330px] lg:h-[460px]">
                  <SchoolSwarm copy={copy} gathering />
                </div>
                <ContextHub copy={copy} glow={[START, START + 0.3]} gathering />
                {/* The hub already names these four; repeating them as pills
                    underneath was the same four words twice. */}
              </div>
            ) : (
              <div className="flex w-full items-center justify-center gap-3 sm:gap-4">
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

  /**
   * The beat after this one, built now and started later.
   *
   * Building a beat at the moment the reader crosses into it put a sixty
   * millisecond task in the middle of a scroll - a dropped frame exactly where
   * the eye is, and the overload beat is the worst of them. It is built one
   * beat early, paused, and let go when it is the one being read.
   *
   * One ahead, not all seven: keeping every beat mounted makes each style
   * recalculation walk a tree several times the size, which cost far more
   * during a scroll than the mount it saved.
   */
  // Not when scrolling back: the beat just left is also the beat ahead, and
  // rendering it as both gives two stages the same key - React then has two
  // children claiming one identity and keeps the wrong one.
  const waitingIndex = index + 1
  const waitingChapter =
    visible && waitingIndex < total && waitingIndex !== leaving ? copy.why.chapters[waitingIndex] : null

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
              state="leaving"
              carried={carriedInto(copy, leaving!)}
            />
          )}
          <BeatStage
            key={current.mode}
            copy={copy}
            current={current}
            state="current"
            carried={carriedInto(copy, index)}
          />
          {/* Built during idle time, started later - so the reader never
              scrolls into the cost of building one. */}
          {waitingChapter && (
            <BeatStage
              key={waitingChapter.mode}
              copy={copy}
              current={waitingChapter}
              state="waiting"
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
