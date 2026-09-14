"use client"
import { useState } from 'react'
import { SCHOOL_LOGOS } from '@/lib/landing-content'
import { cn } from '@/lib/utils'

/**
 * An institution's mark, falling back to a monogram tile when there is no file
 * for that name or the file fails to load - so a missing asset degrades to
 * something deliberate rather than a broken-image icon.
 */
export function SchoolLogo({ name, className }: { name: string; className?: string }) {
  const src = SCHOOL_LOGOS[name]
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground',
          className,
        )}
      >
        {name.slice(0, 1)}
      </span>
    )
  }

  return (
    // Plain <img>: these are tiny fixed-size marks, so the loader machinery
    // around next/image would cost more than it saves.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('rounded object-contain', className)}
    />
  )
}
