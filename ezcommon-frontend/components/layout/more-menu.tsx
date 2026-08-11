"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'

const items = [
  { key: 'nav.pricing', href: '/pricing' },
  { key: 'nav.blog', href: '/blog' },
  { key: 'nav.support', href: '/support' },
  { key: 'nav.help', href: '/help' },
]

export function MoreMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const t = useT()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="More"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-md p-2 text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 transition-colors',
          open && 'bg-white/10 text-primary-foreground',
        )}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-40 rounded-md border bg-primary text-primary-foreground shadow-lg z-50 overflow-hidden">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-4 py-2.5 text-sm hover:bg-white/10 transition-colors',
                  isActive && 'bg-white/10 font-medium',
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
