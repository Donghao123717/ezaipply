"use client"
import { cn } from '@/lib/utils'

/**
 * The officer on the other side of the window.
 *
 * Drawn rather than streamed. A talking-head service would cost money per
 * question and add seconds of latency to something whose whole point is that
 * it comes at you fast - and an applicant is not rehearsing a particular
 * face, they are rehearsing being looked at and answering immediately. A
 * figure that holds your gaze and speaks on cue does that job.
 *
 * `speaking` drives the mouth. Everything else - the blink, the small idle
 * drift - runs regardless, because a figure that freezes between questions
 * stops reading as a person and starts reading as a placeholder.
 */
export function InterviewerAvatar({
  speaking,
  className,
}: {
  speaking: boolean
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-primary', className)}>
      {/* The booth behind them: glass, a strip of counter, nothing to look at.
          It is meant to feel institutional. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, hsl(var(--primary-foreground) / 0.10), transparent 60%), linear-gradient(hsl(var(--primary)), hsl(var(--primary)) 70%, hsl(var(--primary-foreground) / 0.08))',
        }}
      />

      <svg
        viewBox="0 0 200 200"
        className="relative h-full w-full"
        role="img"
        aria-label="Consular officer"
      >
        <defs>
          <clipPath id="officer-hair">
            <path d="M62 78 Q62 40 100 40 Q138 40 138 78 L138 66 Q120 54 100 54 Q80 54 62 66 Z" />
          </clipPath>
        </defs>

        {/* Shoulders and collar - a suit, because they are on duty. */}
        <path d="M40 200 Q40 150 100 150 Q160 150 160 200 Z" fill="hsl(var(--primary-foreground) / 0.14)" />
        <path d="M86 152 L100 176 L114 152 L108 148 L100 162 L92 148 Z" fill="hsl(var(--primary-foreground) / 0.28)" />

        {/* Neck */}
        <rect x="90" y="128" width="20" height="26" rx="8" fill="#d9a884" />

        {/* Head. The whole figure drifts a little so it never sits perfectly still. */}
        <g className="animate-avatar-idle motion-reduce:animate-none" style={{ transformOrigin: '100px 110px' }}>
          <ellipse cx="100" cy="100" rx="38" ry="44" fill="#e8bb92" />
          <path
            d="M62 78 Q62 40 100 40 Q138 40 138 78 L138 66 Q120 54 100 54 Q80 54 62 66 Z"
            fill="hsl(var(--primary) / 0.85)"
            clipPath="url(#officer-hair)"
          />

          {/* Eyes. They blink on their own timer, not on yours. */}
          <g className="animate-avatar-blink motion-reduce:animate-none" style={{ transformOrigin: '100px 96px' }}>
            <ellipse cx="86" cy="96" rx="4.5" ry="5" fill="#2b2b2b" />
            <ellipse cx="114" cy="96" rx="4.5" ry="5" fill="#2b2b2b" />
          </g>
          <path d="M79 86 Q86 82 93 86" stroke="hsl(var(--primary) / 0.8)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M107 86 Q114 82 121 86" stroke="hsl(var(--primary) / 0.8)" strokeWidth="2.5" fill="none" strokeLinecap="round" />

          <path d="M100 104 L97 114 Q100 116 103 114 Z" fill="#d0a078" />

          {/* Mouth: a line when listening, moving when speaking. */}
          {speaking ? (
            <ellipse
              cx="100"
              cy="126"
              rx="9"
              ry="6"
              fill="#7a3b3b"
              className="animate-avatar-speak motion-reduce:animate-none"
              style={{ transformOrigin: '100px 126px' }}
            />
          ) : (
            <path d="M91 126 Q100 129 109 126" stroke="#7a3b3b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
        </g>
      </svg>

      {/* Says which state you are in without needing to read the mouth. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-0.5 backdrop-blur">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            speaking ? 'animate-pulse bg-emerald-400 motion-reduce:animate-none' : 'bg-primary-foreground/40',
          )}
        />
        <span className="text-[10px] font-medium text-primary-foreground/90">
          {speaking ? 'Speaking' : 'Listening'}
        </span>
      </div>
    </div>
  )
}
