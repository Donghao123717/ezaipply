"use client"
import { useLocale } from '@/lib/i18n/locale-context'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className="hidden sm:flex items-center gap-1 text-sm text-primary-foreground/80 hover:text-primary-foreground"
    >
      {locale === 'en' ? 'EN' : '中文'}
    </button>
  )
}
