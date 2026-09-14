"use client"
import { Star } from 'lucide-react'
import { LANDING_UNIVERSITIES, type LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { SchoolLogo } from '@/components/landing/school-logo'

export function SuccessStories({ copy }: { copy: LandingCopy }) {
  const STORIES = copy.stories
  return (
    <section id="stories" className="bg-background py-24">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="flex items-center gap-4">
            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {STORIES.eyebrow}
            </p>
            <span aria-hidden className="h-px flex-1 bg-border" />
          </div>
          <h2 className="mt-10 text-center font-display text-3xl font-semibold text-primary sm:text-4xl">
            {STORIES.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">{STORIES.blurb}</p>
        </Reveal>

        <div className="mt-12 grid items-start gap-4 md:grid-cols-2">
          {STORIES.items.map((item, i) => (
            <Reveal key={item.initials} delay={i * 90}>
              <figure className="relative flex h-full flex-col rounded-2xl border bg-card p-6">
                {/* Decorative quote mark, the way the reference cards mark a pull quote. */}
                <span
                  aria-hidden
                  className="absolute right-5 top-3 select-none font-display text-4xl leading-none text-accent/25"
                >
                  &rdquo;
                </span>
                <div className="flex items-center gap-3">
                  <span
                    style={{ animationDelay: `${i * 100}ms` }}
                    className="flex h-10 w-10 shrink-0 animate-portrait-pop items-center justify-center rounded-full bg-accent/25 text-xs font-semibold text-primary motion-reduce:animate-none"
                  >
                    {item.initials}
                  </span>
                  <figcaption className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">{item.name}</p>
                    <p className="truncate text-xs font-medium text-accent">{item.role}</p>
                  </figcaption>
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <div className="mt-5 flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} aria-hidden className="h-3 w-3 fill-accent text-accent" />
                  ))}
                </div>
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
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border bg-card px-3 py-2 shadow-sm"
                >
                  <SchoolLogo name={name} className="h-5 w-5 shrink-0" />
                  <span className="font-display text-xs text-primary">{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
