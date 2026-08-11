"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AccountMenu } from '@/components/home/account-menu'
import { MoreMenu } from '@/components/layout/more-menu'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { Home } from 'lucide-react'

interface MenuItem {
  key: string
  href: string
}

const menu: MenuItem[] = [
  { key: 'nav.counselor', href: '/counselor' },
  { key: 'nav.profile', href: '/profile' },
  { key: 'nav.writing', href: '/writing' },
  { key: 'nav.colleges', href: '/colleges' },
  { key: 'nav.forecast', href: '/forecast' },
  { key: 'nav.submit', href: '/submit' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const t = useT()

  const name = session?.user?.name || session?.user?.email || 'User'
  const parts = name.split(' ').filter(Boolean)
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <header className="h-16 flex-shrink-0 bg-primary text-primary-foreground">
        <div className="h-full flex items-center px-6 gap-8">
          <Link href="/" className="flex items-center gap-1 font-display text-xl font-semibold tracking-tight shrink-0">
            <span className="text-accent">Ai</span>
            <span>pply</span>
          </Link>

          <nav className="flex items-center gap-1 flex-1">
            <Link
              href="/"
              aria-label={t('nav.home')}
              className={cn(
                'rounded-md p-2 hover:bg-white/10 transition-colors',
                pathname === '/' && 'bg-white/10',
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

          <div className="flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            <AccountMenu initials={initials.toUpperCase()} />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
