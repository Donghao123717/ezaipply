import { queueUserStateSync } from '@/lib/user-state-sync'
import type { CounselorTab } from '@/lib/counselor-chat'

/**
 * One durable fact the counselors have learned about this student. Every
 * specialist reads the whole file, so something the student says in one thread
 * doesn't have to be repeated in another.
 */
export interface CaseNote {
  id: string
  text: string
  /** Which specialist recorded it. */
  source: CounselorTab
  createdAt: string
}

function caseNotesKey(userId: string) {
  return `aipply-case-notes-${userId}`
}

export function loadCaseNotes(userId: string): CaseNote[] {
  try {
    const raw = window.localStorage.getItem(caseNotesKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCaseNotes(userId: string, notes: CaseNote[]) {
  const key = caseNotesKey(userId)
  const value = JSON.stringify(notes)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'for', 'and', 'or', 'in', 'on', 'at',
  'with', 'has', 'have', 'had', 'per', 'about', 'their', 'them', 'they', 'student', 'wants', 'want',
])

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s$]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  )
}

/**
 * The counselors restate facts they already know ("budget of $40k" vs "has a
 * $40k budget per year"), so exact-match dedupe isn't enough to keep the case
 * file from filling with the same fact in different words.
 */
function saysTheSameThing(a: string, b: string): boolean {
  const wordsA = significantWords(a)
  const wordsB = significantWords(b)
  if (wordsA.size === 0 || wordsB.size === 0) return false
  let shared = 0
  for (const word of wordsA) if (wordsB.has(word)) shared += 1
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.7
}

/** Appends a note, ignoring one the file already holds in any wording. */
export function addCaseNote(userId: string, text: string, source: CounselorTab): CaseNote[] {
  const trimmed = text.trim()
  const notes = loadCaseNotes(userId)
  if (!trimmed || notes.some((n) => saysTheSameThing(n.text, trimmed))) return notes
  const next = [
    ...notes,
    {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      source,
      createdAt: new Date().toISOString(),
    },
  ]
  saveCaseNotes(userId, next)
  return next
}

export function removeCaseNote(userId: string, id: string): CaseNote[] {
  const next = loadCaseNotes(userId).filter((n) => n.id !== id)
  saveCaseNotes(userId, next)
  return next
}
