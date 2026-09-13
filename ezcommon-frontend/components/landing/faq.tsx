"use client"
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LandingCopy } from '@/lib/landing-content'
import { Reveal } from '@/components/landing/reveal'
import { cn } from '@/lib/utils'

export function Faq({ copy }: { copy: LandingCopy }) {
  const FAQ = copy.faq
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-3">{FAQ.eyebrow}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-primary">{FAQ.title}</h2>
        </Reveal>

        <div className="mt-10 divide-y border-y">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal key={item.q} delay={i * 60}>
                <div>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-4 text-left group"
                  >
                    <span className="text-sm font-medium text-primary group-hover:text-accent transition-colors">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-all duration-300 ease-out motion-reduce:transition-none',
                      isOpen ? 'grid-rows-[1fr] opacity-100 pb-4' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <p className="overflow-hidden text-sm text-muted-foreground leading-relaxed pr-8">{item.a}</p>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function SiteFooter({ copy }: { copy: LandingCopy }) {
  const FOOTER = copy.footer
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid md:grid-cols-[2fr_1fr_1fr] gap-10">
          <div>
            <p className="font-display text-lg">
              <span className="text-accent">Ai</span>pply
            </p>
            <p className="text-sm text-primary-foreground/60 mt-3 max-w-sm leading-relaxed">{FOOTER.about}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/50">{FOOTER.companyLabel}</p>
            <ul className="mt-3 space-y-2">
              {FOOTER.company.map((link) => (
                <li key={link}>
                  <span className="text-sm text-primary-foreground/75 hover:text-primary-foreground transition-colors cursor-default">
                    {link}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/50">{FOOTER.legalLabel}</p>
            <ul className="mt-3 space-y-2">
              {FOOTER.legal.map((link) => (
                <li key={link}>
                  <span className="text-sm text-primary-foreground/75 cursor-default">{link}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 pt-6 border-t border-primary-foreground/15 text-[11px] leading-relaxed text-primary-foreground/40">
          {FOOTER.disclaimer}
        </p>
        <p className="mt-4 text-[11px] text-primary-foreground/40">{FOOTER.copyright}</p>
      </div>
    </footer>
  )
}
