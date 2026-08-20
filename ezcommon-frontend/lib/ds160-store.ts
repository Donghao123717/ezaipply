export type Ds160Data = Record<string, Record<string, string> | Record<string, string>[]>

function ds160StorageKey(userId: string) {
  return `aipply-ds160-${userId}`
}

export function loadDS160Data(userId: string): Ds160Data {
  try {
    const raw = window.localStorage.getItem(ds160StorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDS160Data(userId: string, data: Ds160Data) {
  window.localStorage.setItem(ds160StorageKey(userId), JSON.stringify(data))
}

/**
 * Serializes the student's saved DS-160 answers into readable text for an AI
 * prompt - same "field: value" summary approach as loadProfileContext in
 * essay-store.ts, extended to handle a section object that itself holds a
 * nested array (e.g. previousWork.schools), not just flat-or-array.
 */
export function loadDS160Context(userId: string): string {
  const data = loadDS160Data(userId)
  const lines: string[] = []
  for (const [sectionKey, value] of Object.entries(data)) {
    if (sectionKey === '_confirmed' || !value) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      lines.push(`${sectionKey}:`)
      value.forEach((item) => {
        const parts = Object.entries(item)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
        if (parts.length) lines.push(`  - ${parts.join(', ')}`)
      })
    } else if (typeof value === 'object') {
      const flatParts: string[] = []
      for (const [k, v] of Object.entries(value)) {
        if (Array.isArray(v)) {
          if (v.length === 0) continue
          lines.push(`${sectionKey}.${k}:`)
          v.forEach((item) => {
            const parts = Object.entries(item)
              .filter(([, iv]) => iv)
              .map(([ik, iv]) => `${ik}: ${iv}`)
            if (parts.length) lines.push(`  - ${parts.join(', ')}`)
          })
        } else if (v) {
          flatParts.push(`${k}: ${v}`)
        }
      }
      if (flatParts.length) lines.push(`${sectionKey}: ${flatParts.join(', ')}`)
    }
  }
  return lines.join('\n')
}
