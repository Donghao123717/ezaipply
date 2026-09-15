import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

/**
 * Gate a page on a signed-in session.
 *
 * Every page behind the app shell needs this, and most of them wrote it out by
 * hand - which is exactly why ten of them ended up without it, rendering the
 * signed-in interface to anyone who typed the URL. One helper so the check is
 * a single line and its absence is obvious.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')
  return session
}
