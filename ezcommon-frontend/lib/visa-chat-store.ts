import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * Per-specialist visa threads, mirroring lib/counselor-chat.ts on the
 * admissions side. Each specialist keeps its own history so switching tabs
 * does not throw away the conversation you were having.
 */
export type VisaTab = 'interviewer' | 'documents' | 'risk' | 'coordinator'

export const VISA_TABS: VisaTab[] = ['interviewer', 'documents', 'risk', 'coordinator']

/**
 * The three classes this product covers. Their interviews barely overlap - a
 * student is asked about their study plan and what brings them home, a visitor
 * about the itinerary and who is paying, an H-1B applicant about the petition
 * and whether the role really needs the degree - so the type steers every
 * prompt, every document we ask for, and every risk check.
 */
export type VisaType = 'F1' | 'B1B2' | 'H1B'

export const VISA_TYPES: VisaType[] = ['F1', 'B1B2', 'H1B']

export interface VisaActionLink {
  label: string
  href: string
}

export interface VisaChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Pages the specialist is sending the applicant to, rendered as chips. */
  links?: VisaActionLink[]
  /** What the specialist checked before answering, shown collapsed. */
  reasoning?: string[]
}

function chatKey(userId: string, tab: VisaTab) {
  return `aipply-visa-chat-${userId}-${tab}`
}

/** The single-thread key this store used before it had specialists. */
function legacyKey(userId: string) {
  return `aipply-visa-chat-${userId}`
}

export function loadVisaChat(userId: string, tab: VisaTab): VisaChatMessage[] {
  try {
    const raw = window.localStorage.getItem(chatKey(userId, tab))
    if (raw) return JSON.parse(raw)
    // An applicant who chatted before the split keeps that history on the
    // interviewer tab rather than finding it gone.
    if (tab === 'interviewer') {
      const legacy = window.localStorage.getItem(legacyKey(userId))
      if (legacy) return JSON.parse(legacy)
    }
    return []
  } catch {
    return []
  }
}

export function saveVisaChat(userId: string, tab: VisaTab, messages: VisaChatMessage[]) {
  const key = chatKey(userId, tab)
  const value = JSON.stringify(messages)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

function visaTypeKey(userId: string) {
  return `aipply-visa-type-${userId}`
}

export function loadVisaType(userId: string): VisaType {
  try {
    const saved = window.localStorage.getItem(visaTypeKey(userId))
    return saved === 'B1B2' || saved === 'H1B' ? saved : 'F1'
  } catch {
    return 'F1'
  }
}

/**
 * The chosen type, or null when nothing has been chosen yet.
 *
 * `loadVisaType` defaults to F-1 so every downstream caller has something to
 * work with. That default is wrong as an answer to "has this applicant told us
 * yet?" - it is what let a visitor be shown the student checklist without ever
 * being asked.
 */
export function chosenVisaType(userId: string): VisaType | null {
  try {
    const saved = window.localStorage.getItem(visaTypeKey(userId))
    return saved === 'B1B2' || saved === 'H1B' || saved === 'F1' ? saved : null
  } catch {
    return 'F1'
  }
}

export function saveVisaType(userId: string, type: VisaType) {
  const key = visaTypeKey(userId)
  window.localStorage.setItem(key, type)
  queueUserStateSync(key, type)
}
