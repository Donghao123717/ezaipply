"use client"
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * A thin bar across the top of the app while a page is being fetched.
 *
 * Moving between pages takes between seventy and two hundred and fifty
 * milliseconds, which is quick - but with nothing on screen acknowledging the
 * click, a quarter of a second reads as the app having stalled. The bar starts
 * the moment a link is clicked and finishes when the new path lands, so the
 * wait is visible as progress rather than as nothing happening.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const doneTimer = useRef<ReturnType<typeof setTimeout>>()

  // The new route has rendered: run the bar out and clear it.
  useEffect(() => {
    setState((prev) => (prev === 'loading' ? 'done' : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => {
    if (state !== 'done') return
    doneTimer.current = setTimeout(() => setState('idle'), 260)
    return () => clearTimeout(doneTimer.current)
  }, [state])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Anything the browser handles itself - a new tab, a download, an
      // external host - is not a route change and gets no bar.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (!href.startsWith('/') || href.startsWith('//')) return
      const [path] = href.split('?')
      if (path === window.location.pathname) return
      setState('loading')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  if (state === 'idle') return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden>
      <div
        className="h-full bg-accent transition-[width,opacity] ease-out motion-reduce:transition-none"
        style={
          state === 'loading'
            // Creeps towards the end without reaching it: the bar cannot know
            // how long the fetch will take, and one that completes early and
            // then waits is worse than one that is still moving.
            ? { width: '88%', opacity: 1, transitionDuration: '1.4s' }
            : { width: '100%', opacity: 0, transitionDuration: '220ms' }
        }
      />
    </div>
  )
}
