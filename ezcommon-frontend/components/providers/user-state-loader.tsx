"use client"
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { pullUserState, startUserStateSync } from '@/lib/user-state-sync'

/**
 * Loads the signed-in student's saved answers from the backend into this
 * browser before any page reads them.
 *
 * Children are held back until the pull finishes, because every store hydrates
 * synchronously from localStorage and then writes back - rendering early would
 * let an empty browser overwrite the account's saved data.
 */
export function UserStateLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id as string | undefined
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !userId || loadedFor === userId) return
    let cancelled = false

    pullUserState(userId)
      .then(() => {
        if (cancelled) return
        // Only push writes once we know what the server already has.
        startUserStateSync(userId)
      })
      .catch((e) => {
        // Stay usable offline: keep this browser's copy, but don't sync up and
        // risk overwriting the account with data we failed to read.
        console.warn('Could not load saved data; continuing without sync', e)
      })
      .finally(() => {
        if (!cancelled) setLoadedFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [status, userId, loadedFor])

  if (status === 'authenticated' && userId && loadedFor !== userId) {
    return null
  }

  return <>{children}</>
}
