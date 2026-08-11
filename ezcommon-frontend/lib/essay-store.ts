export interface EssayRecord {
  html: string
  promptId: string | null
  updatedAt: string
}

export type EssayStore = Record<string, EssayRecord>

function essaysKey(userId: string) {
  return `aipply-essays-${userId}`
}

export function loadEssays(userId: string): EssayStore {
  try {
    const raw = window.localStorage.getItem(essaysKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveEssay(userId: string, taskId: string, record: EssayRecord) {
  const store = loadEssays(userId)
  store[taskId] = record
  window.localStorage.setItem(essaysKey(userId), JSON.stringify(store))
}

export function wordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/** Flattens the saved Common Profile (see lib/profile-schema.ts) into plain text for LLM prompts. */
export function loadProfileContext(userId: string): string {
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (!raw) return ''
    const data = JSON.parse(raw) as Record<string, any>
    const lines: string[] = []
    for (const [sectionKey, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        lines.push(`${sectionKey}:`)
        value.forEach((item) => {
          const parts = Object.entries(item)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
          if (parts.length) lines.push(`  - ${parts.join(', ')}`)
        })
      } else if (value && typeof value === 'object') {
        const parts = Object.entries(value)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
        if (parts.length) lines.push(`${sectionKey}: ${parts.join(', ')}`)
      }
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}
