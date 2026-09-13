"use client"
import Link from 'next/link'
import { QrCode } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'

export function Rewards({ copy }: { copy: LandingCopy }) {
  const REWARDS = copy.rewards
  return (
    <section id="rewards" className="bg-secondary/30 py-24 border-y">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-3">{REWARDS.eyebrow}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-primary max-w-2xl">{REWARDS.title}</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">{REWARDS.blurb}</p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 items-start">
          {REWARDS.cards.map((card, i) => (
            <Reveal key={card.label} delay={i * 90}>
              <div className="h-full rounded-2xl border bg-card p-5 hover:border-accent/40 transition-colors">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{card.label}</p>
                <p className="font-display text-lg text-primary mt-2 leading-snug">{card.title}</p>
                <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">{card.body}</p>
                <p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t">{card.note}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col lg:flex-row items-center justify-center gap-8">
            <div className="w-full max-w-sm rounded-2xl border bg-primary text-primary-foreground p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{REWARDS.inviteLabel}</p>
              <div className="flex items-end justify-between gap-4 mt-4">
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-primary-foreground/50">{REWARDS.inviteFields.name}</p>
                    <p className="text-sm">{'Karen Mills'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-primary-foreground/50">{REWARDS.inviteFields.code}</p>
                    <p className="text-sm font-semibold tracking-wider">{'KMILLS'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-primary-foreground/50">{REWARDS.inviteFields.link}</p>
                    <p className="text-xs truncate text-primary-foreground/80">{'aipply.com/i/kmills'}</p>
                  </div>
                </div>
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                  <QrCode className="h-12 w-12 text-primary-foreground/60" />
                </span>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-sm bg-primary px-7 py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {REWARDS.cta}
              </Link>
              <p className="text-xs text-muted-foreground mt-2.5">{REWARDS.ctaNote}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
