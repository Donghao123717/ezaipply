import { queueUserStateSync } from '@/lib/user-state-sync'

/** How far a finished essay carries toward a prompt the student hasn't written yet. */
export interface EssayMatch {
  sourceTaskId: string
  targetTaskId: string
  score: number
  reason: string
}

/** The prompt worth writing next because it unlocks the most reuse. */
export interface NextUpSuggestion {
  taskId: string
  reason: string
  unlocks: number
}

export interface EssayMatchSet {
  generatedAt: string
  matches: EssayMatch[]
  nextUp: NextUpSuggestion | null
}

function matchesKey(userId: string) {
  return `aipply-essay-matches-${userId}`
}

export function loadEssayMatches(userId: string): EssayMatchSet | null {
  try {
    const raw = window.localStorage.getItem(matchesKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveEssayMatches(userId: string, set: EssayMatchSet | null) {
  const key = matchesKey(userId)
  if (!set) {
    window.localStorage.removeItem(key)
    queueUserStateSync(key, null)
    return
  }
  const value = JSON.stringify(set)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
