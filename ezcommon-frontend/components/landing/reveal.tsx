"use client"
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades content in as it scrolls into view.
 *
 * Two deliberate safeguards: readers who ask for reduced motion get the content
 * immediately, and a timeout shows it anyway if the observer never fires - a
 * marketing page that stays blank because an observer didn't run is worse than
 * one without animation.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const node = ref.current
    const fallback = setTimeout(() => setShown(true), 2000)

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          observer.disconnect()
          clearTimeout(fallback)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )

    if (node) observer.observe(node)
    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
