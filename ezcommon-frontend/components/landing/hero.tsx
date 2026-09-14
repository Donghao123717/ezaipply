"use client"
import Link from 'next/link'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { VideoBackdrop } from '@/components/landing/video-backdrop'
import { useStartHref } from '@/lib/use-start-href'

export function Hero({ copy }: { copy: LandingCopy }) {
  const startHref = useStartHref()
  const HERO = copy.hero
  return (
    <section
      id="hero"
      className="relative flex min-h-[92vh] items-center overflow-hidden bg-primary text-primary-foreground"
    >
      <VideoBackdrop />

      {/* Directional wash: heaviest at the left so the copy always has contrast,
          whatever the footage underneath happens to be doing. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/45"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <Reveal>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            {HERO.title[0]}
            <br />
            {HERO.title[1]}
          </h1>
        </Reveal>

        <Reveal delay={100}>
          <p className="mt-7 max-w-lg border-l-2 border-accent pl-4 text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            {HERO.blurb}
          </p>
        </Reveal>

        <Reveal delay={200}>
          {/* Solid, square, high-contrast - the one thing on the hero that is
              meant to be clicked should not look like the border-only chrome. */}
          <Link
            href={startHref}
            className="mt-9 inline-flex items-center rounded-sm bg-primary-foreground px-8 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {HERO.cta}
          </Link>
        </Reveal>

        <Reveal delay={300}>
          <ul className="mt-12 space-y-2.5">
            {HERO.credibility.map((item) => (
              <li key={item.bold} className="flex items-baseline gap-2 text-sm">
                <span className="text-accent">•</span>
                <span className="font-semibold">{item.bold}</span>
                <span className="text-primary-foreground/55">· {item.rest}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* Feathered edge into the cream section below, so the two do not meet
          on a hard line. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background"
      />

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/40">
          {HERO.scrollHint}
        </span>
        <span className="h-8 w-px animate-float bg-gradient-to-b from-primary-foreground/40 to-transparent motion-reduce:animate-none" />
      </div>
    </section>
  )
}
