"use client"
import { LANDING_UNIVERSITIES, type LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'

export function SuccessStories({ copy }: { copy: LandingCopy }) {
  const STORIES = copy.stories
  return (
    <section id="stories" className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-3">{STORIES.eyebrow}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-primary">{STORIES.title}</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">{STORIES.blurb}</p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4 mt-12 items-start">
          {STORIES.items.map((item, i) => (
            <Reveal key={item.initials} delay={i * 90}>
              <figure className="h-full rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span
                    style={{ animationDelay: `${i * 100}ms` }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold animate-portrait-pop motion-reduce:animate-none"
                  >
                    {item.initials}
                  </span>
                  <figcaption className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.role}</p>
                  </figcaption>
                </div>
                <blockquote className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={100}>
        <div className="mt-16">
          <p className="text-center text-xs uppercase tracking-[0.14em] text-muted-foreground px-6">
            {STORIES.marqueeTitle}
          </p>
          {/* Duplicated once so the -50% keyframe loops seamlessly. */}
          <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max gap-3 animate-marquee motion-reduce:animate-none hover:[animation-play-state:paused]">
              {[...LANDING_UNIVERSITIES, ...LANDING_UNIVERSITIES].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="whitespace-nowrap rounded-full border bg-card px-4 py-1.5 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
