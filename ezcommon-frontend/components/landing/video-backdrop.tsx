"use client"

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
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
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
        className="absolute inset-0 animate-ken-burns motion-reduce:animate-none"
        style={{
          background:
            'radial-gradient(1200px 700px at 72% 18%, hsl(var(--accent) / 0.30), transparent 60%), radial-gradient(900px 620px at 12% 88%, hsl(var(--accent) / 0.14), transparent 58%), radial-gradient(700px 500px at 40% 50%, hsl(var(--primary-foreground) / 0.08), transparent 65%)',
        }}
      />
    </div>
  )
}
