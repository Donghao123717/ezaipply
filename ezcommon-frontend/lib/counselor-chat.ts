export type CounselorTab = 'team' | 'strategist' | 'essay' | 'coordinator'

export interface CounselorMessage {
  role: 'user' | 'assistant'
  content: string
}

function chatKey(userId: string, tab: CounselorTab) {
  return `aipply-counselor-${userId}-${tab}`
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
}
