import { useLocale } from '@/lib/i18n/locale-context'
import { dictionary } from '@/lib/i18n/dictionary'

function getPath(obj: any, path: string): unknown {
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
