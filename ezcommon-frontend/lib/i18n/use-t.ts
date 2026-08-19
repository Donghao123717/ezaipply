import { useLocale } from '@/lib/i18n/locale-context'
import { dictionary } from '@/lib/i18n/dictionary'

// "common.options.<value>" keys are built by interpolating raw option text
// (e.g. "U.S. citizen or U.S. national") that can itself contain dots, which
// would otherwise collide with the "." path separator below. Since
// common.options is always a flat leaf map, treat everything after this
// prefix as a single key instead of splitting it further.
const OPTIONS_PREFIX = 'common.options.'

function getPath(obj: any, path: string): unknown {
  if (path.startsWith(OPTIONS_PREFIX)) {
    return obj?.common?.options?.[path.slice(OPTIONS_PREFIX.length)]
  }
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj)
}

/** t('home.greetingMorning') -> looks up dictionary[locale].home.greetingMorning, falling back to the key itself. */
export function useT() {
  const { locale } = useLocale()
  return function t(key: string): string {
    const value = getPath((dictionary as any)[locale], key)
    if (typeof value === 'string') return value
    const fallback = getPath((dictionary as any).en, key)
    return typeof fallback === 'string' ? fallback : key
  }
}
