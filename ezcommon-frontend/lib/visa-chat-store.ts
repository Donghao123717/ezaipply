import { queueUserStateSync } from '@/lib/user-state-sync'

export interface VisaChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function chatKey(userId: string) {
  return `aipply-visa-chat-${userId}`
}

export function loadVisaChat(userId: string): VisaChatMessage[] {
  try {
    const raw = window.localStorage.getItem(chatKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveVisaChat(userId: string, messages: VisaChatMessage[]) {
  const key = chatKey(userId)
  const value = JSON.stringify(messages)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
