"use client"
import Link from 'next/link'
import { useLocale } from '@/lib/i18n/locale-context'

/**
 * The public site header. Shared by the landing page and the auth pages so the
 * nav does not simply vanish the moment someone goes to sign in - they should
 * still be able to get back to the site, or switch language, from there.
 *
 * `action` swaps the right-hand button: the landing page offers sign-in, the
 * sign-in page offers registration, and vice versa.
 */
export function SiteHeader({ action }: { action: 'signIn' | 'register' | 'none' }) {
  const { locale, setLocale } = useLocale()
  const zh = locale === 'zh'

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
          {action !== 'none' && (
            <Link
              href={action === 'signIn' ? '/auth/login' : '/auth/register'}
              className="rounded-sm border border-primary-foreground/30 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary"
            >
              {action === 'signIn' ? (zh ? '登录' : 'Sign in') : zh ? '注册' : 'Create account'}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
