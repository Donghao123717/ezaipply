import { queueUserStateSync } from '@/lib/user-state-sync'

export type CounselorTab = 'team' | 'strategist' | 'essay' | 'coordinator'

export interface CounselorActionLink {
  label: string
  href: string
}

export interface CounselorMessage {
  role: 'user' | 'assistant'
  content: string
  /** Pages the counselor is sending the student to, rendered as chips under the reply. */
  links?: CounselorActionLink[]
  /** What the counselor checked before answering, shown in a collapsed row. */
  reasoning?: string[]
}

function chatKey(userId: string, tab: CounselorTab) {
  return `aipply-counselor-${userId}-${tab}`
}

function chatUpdatedAtKey(userId: string, tab: CounselorTab) {
  return `aipply-counselor-${userId}-${tab}-updatedAt`
}

export function loadCounselorChat(userId: string, tab: CounselorTab): CounselorMessage[] {
  try {
    const raw = window.localStorage.getItem(chatKey(userId, tab))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCounselorChat(userId: string, tab: CounselorTab, messages: CounselorMessage[]) {
  const key = chatKey(userId, tab)
  const value = JSON.stringify(messages)
  const updatedAtKey = chatUpdatedAtKey(userId, tab)
  const updatedAt = new Date().toISOString()
  window.localStorage.setItem(key, value)
  window.localStorage.setItem(updatedAtKey, updatedAt)
  queueUserStateSync(key, value)
  queueUserStateSync(updatedAtKey, updatedAt)
}

export function loadCounselorChatUpdatedAt(userId: string, tab: CounselorTab): string | null {
  try {
    return window.localStorage.getItem(chatUpdatedAtKey(userId, tab))
  } catch {
    return null
  }
}
