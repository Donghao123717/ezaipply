import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * An essay the student wrote before they got here, imported from a file. It
 * isn't tied to any writing task - it exists purely as raw material that reuse
 * can expand across the school list.
 */
export interface ImportedSource {
  id: string
  title: string
  text: string
  wordCount: number
  importedAt: string
}

/** Imported sources share the task-id namespace so matches can point at either. */
export const IMPORT_ID_PREFIX = 'import-'

export function isImportedId(id: string): boolean {
  return id.startsWith(IMPORT_ID_PREFIX)
}

function sourcesKey(userId: string) {
  return `aipply-essay-sources-${userId}`
}

export function loadImportedSources(userId: string): ImportedSource[] {
  try {
    const raw = window.localStorage.getItem(sourcesKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveImportedSources(userId: string, sources: ImportedSource[]) {
  const key = sourcesKey(userId)
  const value = JSON.stringify(sources)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

export function addImportedSource(
  userId: string,
  source: { title: string; text: string; wordCount: number },
): ImportedSource[] {
  const next = [
    ...loadImportedSources(userId),
    {
      id: `${IMPORT_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: source.title,
      text: source.text,
      wordCount: source.wordCount,
      importedAt: new Date().toISOString(),
    },
  ]
  saveImportedSources(userId, next)
  return next
}

export function removeImportedSource(userId: string, id: string): ImportedSource[] {
  const next = loadImportedSources(userId).filter((s) => s.id !== id)
  saveImportedSources(userId, next)
  return next
}
