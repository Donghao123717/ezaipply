/**
 * Mirrors the per-user localStorage keys to the backend so a student's answers
 * follow them to another browser or device, instead of living in one browser.
 *
 * The stores stay synchronous against localStorage; this module pulls the
 * server snapshot down before the app renders, and pushes writes back up.
 */

/** Keys that belong to one user's account and should follow them across devices. */
export function isSyncedKey(key: string, userId: string): boolean {
  return key.startsWith('aipply-') && key.includes(userId)
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * A key scoped to some *other* account. Device-wide preferences such as
 * `aipply-mode` and `aipply-locale` carry no user id and are left alone.
 */
function belongsToAnotherUser(key: string, userId: string): boolean {
  if (!key.startsWith('aipply-') || key.includes(userId)) return false
  return UUID_PATTERN.test(key)
}

function backendBase() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
}

/** Overwrite this browser's copy of the user's keys with the server snapshot. */
export async function pullUserState(userId: string): Promise<void> {
  const res = await fetch(`${backendBase()}/api/user-state/${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error(`Failed to load saved data (${res.status})`)
  const data = await res.json()
  const state: Record<string, string> = data?.state ?? {}

  // Drop local keys the server no longer has, so a cleared account doesn't
  // resurrect from a stale browser, and drop whatever the previous person on
  // this machine left behind - their copy is safe on the server.
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i)
    if (!key) continue
    if (belongsToAnotherUser(key, userId) || (isSyncedKey(key, userId) && !(key in state))) {
      window.localStorage.removeItem(key)
    }
  }

  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'string') window.localStorage.setItem(key, value)
  }
}

const pending = new Map<string, string | null>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let activeUserId: string | null = null

async function flush() {
  flushTimer = null
  if (!activeUserId || pending.size === 0) return
  const entries = Object.fromEntries(pending)
  pending.clear()

  try {
    await fetch(`${backendBase()}/api/user-state/${encodeURIComponent(activeUserId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
      keepalive: true,
    })
  } catch {
    // Keep the local copy authoritative for this session; the next write retries.
  }
}

/** Called by the stores after they write to localStorage. */
export function queueUserStateSync(key: string, value: string | null) {
  if (!activeUserId || !isSyncedKey(key, activeUserId)) return
  pending.set(key, value)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, 800)
}

/** Enables syncing once we know who is signed in. */
export function startUserStateSync(userId: string) {
  activeUserId = userId
  if (typeof window === 'undefined') return
  window.addEventListener('pagehide', () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    flush()
  })
}
