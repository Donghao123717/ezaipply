"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Compass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

/** The five stages, in the order a student actually moves through them. */
const STOPS = [
  { key: 'profile', href: '/profile' },
  { key: 'counselor', href: '/counselor' },
  { key: 'colleges', href: '/colleges' },
  { key: 'writing', href: '/writing' },
  { key: 'submit', href: '/submit' },
] as const

function seenKey(userId: string) {
  return `aipply-tour-seen-${userId}`
}

export function ProductTour({ userId }: { userId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    // A returning student shouldn't get the tour thrown at them again; the
    // button stays available for whenever they want it.
    setSeen(window.localStorage.getItem(seenKey(userId)) === 'true')
  }, [userId])

  function close() {
    setOpen(false)
    setStep(0)
    window.localStorage.setItem(seenKey(userId), 'true')
    setSeen(true)
  }

  const stop = STOPS[step]
  const isLast = step === STOPS.length - 1

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          seen ? 'text-muted-foreground hover:bg-muted' : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/15',
        )}
      >
        <Compass className="h-3.5 w-3.5" />
        {t('home.tour.button')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in-up motion-reduce:animate-none"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {t('home.tour.stepOf')
                    .replace('{step}', String(step + 1))
                    .replace('{total}', String(STOPS.length))}
                </p>
                <h3 className="font-display text-xl text-primary mt-1">{t(`home.tour.${stop.key}.title`)}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('common.close')}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Remount per step so the copy animates in rather than swapping silently. */}
            <p key={stop.key} className="px-5 pt-3 text-sm text-muted-foreground leading-relaxed animate-fade-in-up motion-reduce:animate-none">
              {t(`home.tour.${stop.key}.body`)}
            </p>

            <div className="flex items-center gap-1.5 px-5 pt-4">
              {STOPS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={t(`home.tour.${s.key}.title`)}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    i === step ? 'w-6 bg-accent' : 'w-3 bg-muted-foreground/25 hover:bg-muted-foreground/40',
                  )}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t bg-muted/30">
              <button type="button" onClick={close} className="text-xs text-muted-foreground hover:text-foreground">
                {t('home.tour.skip')}
              </button>
              <div className="flex items-center gap-2">
                <Link
                  href={stop.href}
                  onClick={close}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted transition-colors"
                >
                  {t('home.tour.openPage')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Button size="sm" onClick={() => (isLast ? close() : setStep(step + 1))}>
                  {isLast ? t('home.tour.finish') : t('home.tour.next')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
