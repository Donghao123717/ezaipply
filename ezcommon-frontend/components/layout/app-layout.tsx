"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AccountMenu } from '@/components/home/account-menu'
import { MoreMenu } from '@/components/layout/more-menu'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { MobileNav } from '@/components/layout/mobile-nav'
import { RouteProgress } from '@/components/layout/route-progress'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { Home } from 'lucide-react'
import { useMode, type AppMode } from '@/lib/app-mode'

interface MenuItem {
  key: string
  href: string
}

const STUDY_MENU: MenuItem[] = [
  { key: 'nav.counselor', href: '/counselor' },
  { key: 'nav.profile', href: '/profile' },
  { key: 'nav.writing', href: '/writing' },
  { key: 'nav.colleges', href: '/colleges' },
  { key: 'nav.forecast', href: '/forecast' },
  { key: 'nav.submit', href: '/submit' },
]

const VISA_MENU: MenuItem[] = [
  { key: 'nav.visaCounselor', href: '/visa/counselor' },
  { key: 'nav.ds160', href: '/visa/ds160' },
  { key: 'nav.visaPrep', href: '/visa/prep' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const t = useT()
  const { mode, setMode } = useMode()

  function switchMode(next: AppMode) {
    if (next === mode) return
    setMode(next)
    router.push(next === 'visa' ? '/visa/ds160' : '/home')
  }

  const name = session?.user?.name || session?.user?.email || 'User'
  const parts = name.split(' ').filter(Boolean)
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  const menu = mode === 'visa' ? VISA_MENU : STUDY_MENU

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <RouteProgress />
      <header className="h-16 flex-shrink-0 bg-primary text-primary-foreground">
        <div className="flex h-full items-center gap-3 px-4 md:gap-8 md:px-6">
          <MobileNav menu={menu} mode={mode} onSwitchMode={switchMode} />

          <Link href="/" className="flex shrink-0 items-center gap-1 font-display text-xl font-semibold tracking-tight">
            <span className="text-accent">Ai</span>
            <span>pply</span>
          </Link>

          {/* The pill and the link row are the two things that cannot fit a
              phone; both live in the drawer below md. */}
          <div className="hidden shrink-0 items-center gap-0.5 rounded-full bg-white/10 p-0.5 md:flex">
            <button
              onClick={() => switchMode('study')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                mode === 'study' ? 'bg-white text-primary' : 'text-primary-foreground/80 hover:text-primary-foreground',
              )}
            >
              {t('nav.modeStudy')}
            </button>
            <button
              onClick={() => switchMode('visa')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                mode === 'visa' ? 'bg-white text-primary' : 'text-primary-foreground/80 hover:text-primary-foreground',
              )}
            >
              {t('nav.modeVisa')}
            </button>
          </div>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <Link
              href="/home"
              aria-label={t('nav.home')}
              className={cn(
                'rounded-md p-2 hover:bg-white/10 transition-colors',
                pathname === '/home' && 'bg-white/10',
              )}
            >
              <Home className="h-5 w-5" />
            </Link>
            {menu.map((m) => {
              const isActive = pathname === m.href || pathname?.startsWith(m.href + '/')
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={cn(
                    'relative rounded-md px-3 py-2 text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground transition-colors',
                    isActive && 'text-primary-foreground after:absolute after:left-3 after:right-3 after:-bottom-[18px] after:h-0.5 after:bg-accent',
                  )}
                >
                  {t(m.key)}
                </Link>
              )
            })}
            <MoreMenu />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
            <span className="hidden md:block">
              <LanguageSwitcher />
            </span>
            <AccountMenu initials={initials.toUpperCase()} />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
