"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import type { AppMode } from '@/lib/app-mode'

export interface NavItem {
  key: string
  href: string
}

const SECONDARY: NavItem[] = [
  { key: 'nav.pricing', href: '/pricing' },
  { key: 'nav.blog', href: '/blog' },
  { key: 'nav.support', href: '/support' },
  { key: 'nav.help', href: '/help' },
]

/**
 * The navigation for phones.
 *
 * The desktop header laid nine links out in a row that could not wrap, which
 * gave the page a 900px floor - so a phone rendered the whole app at desktop
 * width and zoomed out to fit. Every page looked like a shrunken desktop
 * because it was one. The links move into a drawer below `md`, which lets the
 * header fit a 390px screen and the rest of the layout finally honour its own
 * responsive breakpoints.
 */
export function MobileNav({
  menu,
  mode,
  onSwitchMode,
}: {
  menu: NavItem[]
  mode: AppMode
  onSwitchMode: (next: AppMode) => void
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const t = useT()

  // A drawer that survives navigation would cover the page it just opened.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // The page behind a full-height drawer should not scroll under it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const linkClass = (active: boolean) =>
    cn(
      'block rounded-lg px-3 py-2.5 text-sm transition-colors',
      active ? 'bg-white/15 font-semibold' : 'text-primary-foreground/85 hover:bg-white/10',
    )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('nav.menu')}
        aria-expanded={open}
        className="rounded-md p-2 transition-colors hover:bg-white/10 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label={t('common.close')}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-primary text-primary-foreground shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="font-display text-xl font-semibold tracking-tight">
                <span className="text-accent">Ai</span>pply
              </span>
              <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="rounded-md p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Study and Visa are two different products to the student, so the
                switch stays at the top of the drawer rather than buried in it. */}
            <div className="mx-4 mb-3 flex items-center gap-0.5 rounded-full bg-white/10 p-0.5">
              {(['study', 'visa'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => onSwitchMode(value)}
                  className={cn(
                    'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === value ? 'bg-white text-primary' : 'text-primary-foreground/80',
                  )}
                >
                  {t(value === 'study' ? 'nav.modeStudy' : 'nav.modeVisa')}
                </button>
              ))}
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
              <Link href="/home" className={linkClass(pathname === '/home')}>
                <span className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  {t('nav.home')}
                </span>
              </Link>
              {menu.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(pathname === item.href || !!pathname?.startsWith(item.href + '/'))}
                >
                  {t(item.key)}
                </Link>
              ))}

              <div className="!mt-4 border-t border-white/15 pt-3">
                {SECONDARY.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass(pathname === item.href)}>
                    {t(item.key)}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="border-t border-white/15 px-4 py-3">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
