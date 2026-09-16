import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * What the officer is likely to push on, noted while the form is being filled.
 *
 * The two halves of this product were strangers to each other: the form-filling
 * agent watched an applicant say their uncle is paying and that they have no
 * return ticket, and the mock interviewer - who would have asked about exactly
 * that - never heard about it. These notes are the handover. They are written
 * as the answer is given, because that is the moment the weakness is visible,
 * and read back when the interview starts.
 */

export interface InterviewNote {
  text: string
  /** Where in the form it came up, so the interviewer can be specific. */
  section: string
  at: string
}

function key(userId: string) {
  return `aipply-visa-interview-notes-${userId}`
}

export function loadInterviewNotes(userId: string): InterviewNote[] {
  try {
    const raw = window.localStorage.getItem(key(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addInterviewNote(userId: string, text: string, section: string): InterviewNote[] {
  const trimmed = text.trim()
  if (!trimmed) return loadInterviewNotes(userId)
  const notes = loadInterviewNotes(userId)
  // The same weakness gets spotted more than once as a page is worked through;
  // one note per point is what the interviewer can actually use.
  if (notes.some((n) => n.text === trimmed)) return notes
  const next = [...notes, { text: trimmed, section, at: new Date().toISOString() }].slice(-25)
  const value = JSON.stringify(next)
  window.localStorage.setItem(key(userId), value)
  queueUserStateSync(key(userId), value)
  return next
}

export function clearInterviewNotes(userId: string) {
  window.localStorage.removeItem(key(userId))
  queueUserStateSync(key(userId), null)
}
