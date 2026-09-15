"use client"
import { createContext, useContext, useEffect, useState } from 'react'

export type Locale = 'en' | 'zh'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', setLocale: () => {} })

const STORAGE_KEY = 'aipply-locale'

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh') setLocaleState(saved)
  }, [])

  // Keep <html lang> honest. It is what a screen reader picks a voice from and
  // what the browser offers to translate against, and it was stuck on "en"
  // however much Chinese was on the page.
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  function setLocale(next: Locale) {
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
