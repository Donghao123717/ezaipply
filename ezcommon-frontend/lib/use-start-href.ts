"use client"
import { useSession } from 'next-auth/react'
import { APP_HOME } from '@/lib/app-routes'

/**
 * Where a "get started" button on the public pages should go.
 *
 * The landing page is reachable while signed in, so pointing every CTA at the
 * sign-in form sent people who were already signed in to log in again.
 */
export function useStartHref(): string {
  const { status } = useSession()
  return status === 'authenticated' ? APP_HOME : '/auth/login'
}
