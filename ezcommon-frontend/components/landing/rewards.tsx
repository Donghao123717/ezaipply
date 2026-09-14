"use client"
import Link from 'next/link'
import { ArrowRight, QrCode } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'

export function Rewards({ copy }: { copy: LandingCopy }) {
  const REWARDS = copy.rewards
  return (
    <section id="rewards" className="relative overflow-hidden bg-primary py-24 text-primary-foreground">
      {/* Soft glows rather than a flat navy block - the reference section is
          lit from a couple of directions and reads as depth, not a slab. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(700px 420px at 18% 22%, hsl(var(--accent) / 0.16), transparent 62%), radial-gradient(760px 460px at 82% 78%, hsl(var(--primary-foreground) / 0.10), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{REWARDS.eyebrow}</p>
          <h2 className="max-w-2xl font-display text-3xl font-semibold sm:text-4xl">{REWARDS.title}</h2>
          <p className="mt-3 max-w-2xl text-primary-foreground/70">{REWARDS.blurb}</p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 items-start">
          {REWARDS.cards.map((card, i) => (
            <Reveal key={card.label} delay={i * 90}>
              <div className="h-full rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-5 transition-colors hover:border-accent/50">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{card.label}</p>
                <p className="mt-2 font-display text-lg leading-snug">{card.title}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-primary-foreground/70">{card.body}</p>
                <p className="mt-3 border-t border-primary-foreground/15 pt-3 text-xs text-primary-foreground/55">{card.note}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col lg:flex-row items-center justify-center gap-8">
            <div className="w-full max-w-sm rounded-2xl border border-primary-foreground/20 bg-primary-foreground/[0.08] p-5 backdrop-blur">
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
                className="inline-flex items-center gap-2 rounded-sm bg-accent px-8 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-110"
              >
                {REWARDS.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-2.5 text-xs text-primary-foreground/55">{REWARDS.ctaNote}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
