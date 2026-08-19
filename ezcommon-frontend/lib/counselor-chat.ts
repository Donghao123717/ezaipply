export type CounselorTab = 'team' | 'strategist' | 'essay' | 'coordinator'

export interface CounselorMessage {
  role: 'user' | 'assistant'
  content: string
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
  window.localStorage.setItem(chatKey(userId, tab), JSON.stringify(messages))
  window.localStorage.setItem(chatUpdatedAtKey(userId, tab), new Date().toISOString())
}

export function loadCounselorChatUpdatedAt(userId: string, tab: CounselorTab): string | null {
  try {
    return window.localStorage.getItem(chatUpdatedAtKey(userId, tab))
  } catch {
    return null
  }
}
