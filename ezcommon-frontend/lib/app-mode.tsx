"use client"
import { createContext, useContext, useEffect, useState } from 'react'

export type AppMode = 'study' | 'visa'

interface ModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

const ModeContext = createContext<ModeContextValue>({ mode: 'study', setMode: () => {} })

const STORAGE_KEY = 'aipply-mode'

/**
 * Provided once at the root (see app/providers.tsx) rather than owned locally
 * by AppLayout - AppLayout is instantiated fresh inside every page.tsx, so a
 * component-local useState there resets (and visibly flashes back to the
 * default) on every client-side navigation. A root-level context survives
 * navigation the same way LocaleProvider already does for language.
 */
export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('study')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'study' || saved === 'visa') setModeState(saved)
  }, [])

  function setMode(next: AppMode) {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>
}

export function useMode() {
  return useContext(ModeContext)
}
