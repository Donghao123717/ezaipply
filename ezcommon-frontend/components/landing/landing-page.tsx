"use client"
import { useEffect, useState } from 'react'
import { getLandingCopy, type LandingCopy } from '@/lib/landing-content'
import { useLocale } from '@/lib/i18n/locale-context'
import { Hero } from '@/components/landing/hero'
import { WhyUs } from '@/components/landing/why-us'
import { HowItWorks } from '@/components/landing/how-it-works'
import { SuccessStories } from '@/components/landing/success-stories'
import { Rewards } from '@/components/landing/rewards'
import { Faq, SiteFooter } from '@/components/landing/faq'
import { SiteHeader } from '@/components/landing/site-header'
import { cn } from '@/lib/utils'

/** Dotted section index down the right edge, tracking whatever is on screen. */
function SectionNav({ active, sections }: { active: string; sections: LandingCopy['sections'] }) {
  return (
    /* From lg up. Below that the centred content leaves too little gutter and
       the index would land on top of the cards. */
    <nav
      aria-label="Sections"
      className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-4 lg:flex xl:right-8"
    >
      {/* Hairline spine the dots sit on, so the index reads as one track. */}
      <span aria-hidden className="absolute right-[3px] top-2 bottom-2 w-px bg-muted-foreground/20" />
      {sections.map((section) => {
        const isActive = section.id === active
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="group relative flex items-center justify-end gap-3"
          >
            <span
              className={cn(
                'font-display text-[11px] italic tabular-nums transition-colors',
                isActive ? 'text-accent' : 'text-muted-foreground/45 group-hover:text-muted-foreground',
              )}
            >
              {section.num}
            </span>
            <span
              className={cn(
                'text-[11px] transition-colors',
                isActive ? 'font-medium text-primary' : 'text-muted-foreground/50 group-hover:text-muted-foreground',
              )}
            >
              {section.label}
            </span>
            <span
              className={cn(
                'h-[7px] w-[7px] rounded-full border transition-all',
                isActive
                  ? 'border-accent bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.2)]'
                  : 'border-muted-foreground/40 bg-background',
              )}
            />
          </a>
        )
      })}
    </nav>
  )
}

export function LandingPage() {
  const { locale } = useLocale()
  const copy = getLandingCopy(locale)
  const [active, setActive] = useState<string>('hero')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // The entry covering the most of the viewport wins, so the index never
        // flickers between two sections meeting at the fold.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { threshold: [0.15, 0.4, 0.7] },
    )
    for (const section of copy.sections) {
      const node = document.getElementById(section.id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [copy.sections])

  return (
    <div className="scroll-smooth motion-reduce:scroll-auto">
      <SiteHeader action="signIn" />

      <SectionNav active={active} sections={copy.sections} />

      <main className="pt-14">
        <Hero copy={copy} />
        <WhyUs copy={copy} />
        <HowItWorks copy={copy} />
        <SuccessStories copy={copy} />
        <Rewards copy={copy} />
        <Faq copy={copy} />
      </main>

      <SiteFooter copy={copy} />
    </div>
  )
}
