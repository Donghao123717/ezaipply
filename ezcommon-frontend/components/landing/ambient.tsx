"use client"
import { useEffect, useRef } from 'react'

/**
 * Runs its children's perpetual animations only while they are on screen.
 *
 * An infinite CSS animation does not stop when it scrolls out of view. The
 * logo marquee and the hero's drifting rule were ticking for the whole page:
 * measured on a beat of the scale story, with nothing of theirs visible, they
 * were still costing a style recalculation every frame - sixty a second, for
 * the entire scroll. That is a tax on every other animation on the page, and
 * it is paid for motion nobody can see.
 *
 * `animation-play-state` is the whole mechanism: paused animations are not
 * ticked at all, and resume where they left off rather than restarting.
 */
export function Ambient({
  children,
  className,
  /** Start animating slightly before the element reaches the viewport. */
  margin = '150px',
}: {
  children: React.ReactNode
  className?: string
  margin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        node.style.setProperty(
          '--ambient-play',
          entry.isIntersecting ? 'running' : 'paused',
        )
      },
      { rootMargin: margin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [margin])

  // The custom property cascades, so every animated descendant honours it
  // without needing to know this component exists.
  return (
    <div
      ref={ref}
      className={className}
      style={{ ['--ambient-play' as string]: 'paused' }}
    >
      {children}
    </div>
  )
}
