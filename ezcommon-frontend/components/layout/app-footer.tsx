"use client"
import { getLandingCopy } from '@/lib/landing-content'
import { useLocale } from '@/lib/i18n/locale-context'

/**
 * The disclaimer belongs inside the product too, not only on the marketing
 * page: this is where a student is actually looking at school names and
 * admissions numbers, and where "is this endorsed by the school?" comes up.
 */
export function AppFooter() {
  const { locale } = useLocale()
  const copy = getLandingCopy(locale).footer

  return (
    <footer className="border-t bg-card/40 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {copy.legal.map((item) => (
            <span key={item} className="text-xs text-muted-foreground cursor-default">
              {item}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">{copy.disclaimer}</p>
        <p className="mt-3 text-[11px] text-muted-foreground/70">{copy.copyright}</p>
      </div>
    </footer>
  )
}
