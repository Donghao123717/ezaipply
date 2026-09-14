import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * A mock consular interview: the questions asked, what the applicant answered,
 * and what came back about each answer.
 *
 * The contradictions matter most. An applicant fills the DS-160 weeks before
 * the interview and then answers from memory, and saying something that
 * conflicts with the form is a routine way to turn an interview into a refusal.
 * They cannot see that themselves - we can, because we hold both sides.
 */

export interface ConsistencyFlag {
  severity: 'high' | 'medium' | 'low'
  /** What they just said. */
  said: string
  /** What their DS-160 says instead. */
  formSays: string
  detail: string
}

export interface InterviewTurn {
  question: string
  /** The question in Chinese - the real interview is in English. */
  questionTranslation?: string
  answer: string
  evaluation?: string
  score?: number
  /** The same answer, phrased as natural spoken English. */
  betterAnswer?: string
  consistency?: ConsistencyFlag[]
}

export interface InterviewSession {
  visaType: 'F1' | 'B1B2'
  turns: InterviewTurn[]
  startedAt: string
  done: boolean
}

function key(userId: string) {
  return `aipply-visa-interview-${userId}`
}

export function loadInterview(userId: string): InterviewSession | null {
  try {
    const raw = window.localStorage.getItem(key(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveInterview(userId: string, session: InterviewSession) {
  const k = key(userId)
  const value = JSON.stringify(session)
  window.localStorage.setItem(k, value)
  queueUserStateSync(k, value)
}

export function clearInterview(userId: string) {
  const k = key(userId)
  window.localStorage.removeItem(k)
  // null is the sync layer's delete.
  queueUserStateSync(k, null)
}

/** Every contradiction raised across the session, worst first. */
export function allFlags(session: InterviewSession | null): ConsistencyFlag[] {
  if (!session) return []
  const order = { high: 0, medium: 1, low: 2 }
  return session.turns
    .flatMap((t) => t.consistency || [])
    .sort((a, b) => order[a.severity] - order[b.severity])
}

/** Mean score across answered turns, or null before anything is scored. */
export function averageScore(session: InterviewSession | null): number | null {
  const scored = (session?.turns || []).filter((t) => typeof t.score === 'number')
  if (!scored.length) return null
  return Math.round(scored.reduce((n, t) => n + (t.score || 0), 0) / scored.length)
}
