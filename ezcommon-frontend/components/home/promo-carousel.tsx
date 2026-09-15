"use client"
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FileText, GraduationCap, PenLine, SendHorizonal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

interface Slide {
  key: string
  href: string
  icon: React.ReactNode
  eyebrowKey: string
  titleKey: string
  ctaKey: string
  /** An optional second way in, for slides where there are two real starting points. */
  secondaryHref?: string
  secondaryKey?: string
  noteLabelKey: string
  noteBodyKey: string
}

const slides: Slide[] = [
  {
    key: 'profile',
    href: '/profile',
    icon: <FileText className="h-10 w-10 text-primary" />,
    eyebrowKey: 'home.promo.profileEyebrow',
    titleKey: 'home.promo.profileTitle',
    ctaKey: 'home.promo.profileCta',
    noteLabelKey: 'home.promo.profileNoteLabel',
    noteBodyKey: 'home.promo.profileNoteBody',
  },
  {
    key: 'writing',
    href: '/writing',
    icon: <PenLine className="h-10 w-10 text-primary" />,
    eyebrowKey: 'home.promo.writingEyebrow',
    titleKey: 'home.promo.writingTitle',
    ctaKey: 'home.promo.writingCta',
    noteLabelKey: 'home.promo.writingNoteLabel',
    noteBodyKey: 'home.promo.writingNoteBody',
  },
  {
    key: 'colleges',
    href: '/colleges',
    icon: <GraduationCap className="h-10 w-10 text-primary" />,
    eyebrowKey: 'home.promo.collegesEyebrow',
    titleKey: 'home.promo.collegesTitle',
    ctaKey: 'home.promo.collegesCta',
    // Two genuinely different starting points: open the list you have, or let
    // the counsellor build one. A student with an empty list wants the second.
    secondaryHref: '/colleges?view=recommend',
    secondaryKey: 'home.promo.collegesRecommendCta',
    noteLabelKey: 'home.promo.collegesNoteLabel',
    noteBodyKey: 'home.promo.collegesNoteBody',
  },
  {
    key: 'forecast-submit',
    href: '/forecast',
    icon: <SendHorizonal className="h-10 w-10 text-primary" />,
    eyebrowKey: 'home.promo.forecastEyebrow',
    titleKey: 'home.promo.forecastTitle',
    ctaKey: 'home.promo.forecastCta',
    noteLabelKey: 'home.promo.forecastNoteLabel',
    noteBodyKey: 'home.promo.forecastNoteBody',
  },
]

export function PromoCarousel({ initialIndex = 0 }: { initialIndex?: number }) {
  const t = useT()
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), slides.length - 1))
  const slide = slides[index]

  return (
    // Inverted against the checklist frame on purpose: that zone is a white
    // card holding cream tiles, this one a warm-grey frame holding a white
    // stage. Two zones of the same shade stacked on a cream page is what made
    // the home screen read as one undifferentiated block.
    <div className="relative rounded-2xl border bg-muted/70 p-2 sm:p-3">
      <button
        aria-label={t('common.previous')}
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full border bg-card shadow flex items-center justify-center hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label={t('common.next')}
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-9 w-9 rounded-full border bg-card shadow flex items-center justify-center hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="grid items-center gap-8 rounded-xl bg-card p-6 sm:grid-cols-2 sm:p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">{t(slide.eyebrowKey)}</p>
          <h3 className="font-display text-3xl sm:text-4xl font-semibold text-primary leading-tight mb-6">
            {t(slide.titleKey)}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href={slide.href}>{t(slide.ctaKey)}</Link>
            </Button>
            {slide.secondaryHref && slide.secondaryKey && (
              <Button asChild size="lg" variant="outline">
                <Link href={slide.secondaryHref}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {t(slide.secondaryKey)}
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl border bg-background">
            {slide.icon}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 flex items-start gap-3">
        <span className="mt-1 h-4 w-1 rounded-full bg-accent shrink-0" />
        <p className="text-sm">
          <span className="font-semibold text-primary">{t(slide.noteLabelKey)}. </span>
          <span className="text-muted-foreground">{t(slide.noteBodyKey)}</span>
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 pb-3">
        {slides.map((s, i) => (
          <button
            key={s.key}
            aria-label={`Go to ${t(s.eyebrowKey)}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
          />
        ))}
      </div>
    </div>
  )
}
