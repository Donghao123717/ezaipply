"use client"
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FileText, GraduationCap, PenLine, SendHorizonal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

interface Slide {
  key: string
  href: string
  icon: React.ReactNode
  eyebrowKey: string
  titleKey: string
  ctaKey: string
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
    <div className="relative rounded-2xl bg-card border p-2 sm:p-3">
      <button
        aria-label="Previous"
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full border bg-card shadow flex items-center justify-center hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label="Next"
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-9 w-9 rounded-full border bg-card shadow flex items-center justify-center hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="rounded-xl bg-muted/60 p-6 sm:p-10 grid sm:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">{t(slide.eyebrowKey)}</p>
          <h3 className="font-display text-3xl sm:text-4xl font-semibold text-primary leading-tight mb-6">
            {t(slide.titleKey)}
          </h3>
          <Button asChild size="lg">
            <Link href={slide.href}>{t(slide.ctaKey)}</Link>
          </Button>
        </div>
        <div className="flex items-center justify-center">
          <div className="h-40 w-40 rounded-2xl bg-card border flex items-center justify-center shadow-sm">
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
