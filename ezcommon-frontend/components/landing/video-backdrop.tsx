"use client"
import { useEffect, useRef } from 'react'

/**
 * The looping campus clip used behind the hero and the auth pages, with the
 * poster standing in until it decodes. Set NEXT_PUBLIC_HERO_VIDEO to swap in
 * different footage, or to '' to fall back to the gradient wash alone.
 */
export const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO ?? '/hero-loop.mp4'
const HERO_POSTER = '/hero-poster.jpg'
/** A light still of the same frame, for pages that should not pay for video. */
const HERO_STILL = '/hero-still.jpg'

export function VideoBackdrop({ still = false }: { still?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)

  /**
   * Stop decoding once the hero has scrolled away.
   *
   * The clip was left playing for the whole page - twelve thousand pixels of
   * scroll spent decoding video nobody can see, competing with the scroll-linked
   * animation below it for the same main thread. The drift is paused with it,
   * for the same reason.
   */
  useEffect(() => {
    const box = boxRef.current
    if (!box || still) return
    const video = box.querySelector('video')
    const drift = box.querySelector<HTMLElement>('[data-drift]')
    if (!video && !drift) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        if (video) {
          if (visible) void video.play().catch(() => {})
          else video.pause()
        }
        if (drift) drift.style.animationPlayState = visible ? 'running' : 'paused'
      },
      { threshold: 0 },
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [still])

  return (
    <div ref={boxRef} aria-hidden className="absolute inset-0 overflow-hidden">
      {/* The sign-in pages get the still, not the clip.
          The video is 6.3 MB and the poster another 0.4 MB, and a browser with
          a cold cache - a new incognito window, or a first-time visitor -
          downloads all of it before the form is usable. That is a lot to spend
          on decoration behind a two-field form, and it is spent at exactly the
          moment someone is deciding whether this product feels slow. The
          landing page still gets the clip, which is where it earns it. */}
      {still ? (
        <img
          src={HERO_STILL}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
      ) : (
        HERO_VIDEO && (
        <video
          // React sets `muted` as a property but never as the HTML attribute,
          // and Chrome's autoplay policy reads the attribute - so
          // `defaultMuted` is what actually lets this start on its own.
          ref={(el) => {
            if (el) el.defaultMuted = true
          }}
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          poster={HERO_POSTER}
          autoPlay
          loop
          muted
          playsInline
        />
        )
      )}
      {/* Keeps the drift alive in the corners the clip does not reach. */}
      <div
        data-drift
        className="absolute inset-0 animate-ken-burns will-change-transform motion-reduce:animate-none"
        style={{
          background:
            'radial-gradient(1200px 700px at 72% 18%, hsl(var(--accent) / 0.30), transparent 60%), radial-gradient(900px 620px at 12% 88%, hsl(var(--accent) / 0.14), transparent 58%), radial-gradient(700px 500px at 40% 50%, hsl(var(--primary-foreground) / 0.08), transparent 65%)',
        }}
      />
    </div>
  )
}
