"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'
import { LocaleProvider } from '@/lib/i18n/locale-context'
import { ModeProvider } from '@/lib/app-mode'
import { UserStateLoader } from '@/components/providers/user-state-loader'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ModeProvider>
            <UserStateLoader>{children}</UserStateLoader>
          </ModeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

