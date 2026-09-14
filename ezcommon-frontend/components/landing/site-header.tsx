"use client"
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useLocale } from '@/lib/i18n/locale-context'
import { APP_HOME } from '@/lib/app-routes'

/**
 * The public site header. Shared by the landing page and the auth pages so the
 * nav does not simply vanish the moment someone goes to sign in - they should
 * still be able to get back to the site, or switch language, from there.
 *
 * It reads the session because the landing page is public but reachable while
 * signed in: clicking the wordmark from inside the app lands here, and a header
 * that offered "Sign in" to someone already signed in read as having been
 * logged out, with no way back to their work. Signed-in visitors get a way into
 * the app instead.
 *
 * `action` only decides what to offer a signed-out visitor - the sign-in page
 * points at registration, and the other way round.
 */
export function SiteHeader({ action }: { action: 'signIn' | 'register' | 'none' }) {
  const { locale, setLocale } = useLocale()
  const { status } = useSession()
  const zh = locale === 'zh'
  const signedIn = status === 'authenticated'

  const cta = signedIn
    ? { href: APP_HOME, label: zh ? '进入应用' : 'Go to app' }
    : action === 'register'
      ? { href: '/auth/register', label: zh ? '注册' : 'Create account' }
      : { href: '/auth/login', label: zh ? '登录' : 'Sign in' }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-primary-foreground/10 bg-primary/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-lg tracking-tight text-primary-foreground">
          <span className="text-accent">Ai</span>pply
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocale(zh ? 'en' : 'zh')}
            className="text-xs text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            {zh ? 'EN' : '中文'}
          </button>
          {/* Hidden until the session is known, so a signed-in visitor never
              sees "Sign in" flash before it resolves. */}
          {(action !== 'none' || signedIn) && status !== 'loading' && (
            <Link
              href={cta.href}
              className="rounded-sm border border-primary-foreground/30 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
