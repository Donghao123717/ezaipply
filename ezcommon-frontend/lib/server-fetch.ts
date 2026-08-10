import { headers } from 'next/headers'

// Server Components can't use a relative URL with fetch() (there's no
// browser location to resolve it against), so build an absolute one from
// the incoming request's host instead.
export async function getBackendBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}/api/backend`
}
