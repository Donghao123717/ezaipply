"use client"
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

/**
 * A workspace side panel: a permanent rail on a wide screen, a slide-over on a
 * narrow one.
 *
 * The three-column workspaces (documents · chat · insights, tasks · editor ·
 * coach) assumed a desktop. On a phone the columns simply kept their widths,
 * so the middle one - the part you actually work in - was squeezed to a
 * hundred pixels and the page scrolled sideways. Below `lg` the rails come off
 * the flow and open over the page instead, which leaves the working column the
 * full width of the screen.
 */
export function SideRail({
  side,
  width,
  open,
  onClose,
  label,
  className,
  children,
}: {
  side: 'left' | 'right'
  /** Tailwind width class for the docked rail, e.g. "w-72". */
  width: string
  open: boolean
  onClose: () => void
  label: string
  className?: string
  children: React.ReactNode
}) {
  const t = useT()

  // Escape closes the slide-over; on a docked rail there is nothing to close,
  // and `open` is ignored at lg and above.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {open && (
        <button
          aria-label={t('common.close')}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <aside
        aria-label={label}
        className={cn(
          width,
          'h-full shrink-0 overflow-y-auto bg-card/50',
          side === 'left' ? 'border-r' : 'border-l',
          // Off the flow and over the page below lg.
          'max-lg:fixed max-lg:inset-y-0 max-lg:z-50 max-lg:bg-card max-lg:shadow-xl max-lg:transition-transform max-lg:duration-200 motion-reduce:max-lg:transition-none',
          side === 'left' ? 'max-lg:left-0' : 'max-lg:right-0',
          open ? 'max-lg:translate-x-0' : side === 'left' ? 'max-lg:-translate-x-full' : 'max-lg:translate-x-full',
          className,
        )}
      >
        <div className="flex items-center justify-end px-2 pt-2 lg:hidden">
          <button onClick={onClose} aria-label={t('common.close')} className="rounded-md p-1.5 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        {children}
      </aside>
    </>
  )
}
