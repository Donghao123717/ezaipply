"use client"
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'

export function Hero({ copy }: { copy: LandingCopy }) {
  const HERO = copy.hero
  return (
    <section id="hero" className="relative min-h-[88vh] flex items-center bg-primary text-primary-foreground overflow-hidden">
      {/* Ambient wash rather than a photo: nothing to load, nothing to misattribute. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(1100px 600px at 78% 8%, hsl(var(--accent) / 0.25), transparent 62%), radial-gradient(900px 500px at 8% 92%, hsl(var(--accent) / 0.12), transparent 60%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <Reveal>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.15] tracking-tight max-w-3xl">
            {HERO.title[0]}
            <br />
            {HERO.title[1]}
          </h1>
        </Reveal>

        <Reveal delay={100}>
          <p className="mt-7 border-l-2 border-accent/70 pl-4 text-base sm:text-lg text-primary-foreground/75 max-w-lg leading-relaxed">
            {HERO.blurb}
          </p>
        </Reveal>

        <Reveal delay={200}>
          <Link
            href="/auth/login"
            className="group mt-9 inline-flex items-center gap-2 rounded-sm border border-primary-foreground/30 px-7 py-3.5 text-sm font-medium uppercase tracking-[0.14em] hover:bg-primary-foreground hover:text-primary transition-colors"
          >
            {HERO.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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

      {/* Scroll hint: their hero has one, and this page is tall enough to need it. */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/40">
          {HERO.scrollHint}
        </span>
        <span className="h-8 w-px bg-gradient-to-b from-primary-foreground/40 to-transparent animate-float motion-reduce:animate-none" />
      </div>
    </section>
  )
}
