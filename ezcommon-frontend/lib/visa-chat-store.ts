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
  window.localStorage.setItem(chatKey(userId), JSON.stringify(messages))
}
