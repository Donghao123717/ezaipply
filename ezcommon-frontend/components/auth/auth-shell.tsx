"use client"
import { VideoBackdrop } from '@/components/landing/video-backdrop'
import { SiteHeader } from '@/components/landing/site-header'

/**
 * Frames the sign-in and registration forms the way the landing page frames
 * its hero: the same campus footage behind, the same site header above.
 *
 * These pages used to be a bare card on an empty page with no way back to the
 * site and no language switch, which made signing in feel like leaving the
 * product rather than entering it.
 */
export function AuthShell({
  children,
  action,
}: {
  children: React.ReactNode
  /** Which way the header's button should point, away from the current page. */
  action: 'signIn' | 'register'
}) {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-primary px-4 py-24">
      <VideoBackdrop still />
      {/* Enough wash for the card edge to read against moving footage, but
          not so much that the campus turns into a flat navy rectangle - the
          point of the clip is that you can see it. Darker at the edges so the
          centre, where the card sits, stays the calmest part of the frame. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, hsl(var(--primary) / 0.45), hsl(var(--primary) / 0.82) 70%, hsl(var(--primary) / 0.92))',
        }}
      />

      <SiteHeader action={action} />

      {/* Solid, not glass: the form is dense and has to stay legible over
          whatever the video is doing behind it. */}
      <div className="relative w-full max-w-md rounded-xl border bg-card p-7 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.8)]">
        {children}
      </div>
    </main>
  )
}
