import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * A generated adaptation waiting on the student. Previews are deliberately kept
 * out of the essay store: nothing lands in a writing task until the student
 * reads it and accepts it, so a batch expansion can never quietly overwrite
 * work or fill the app with drafts they never asked for.
 */
export interface EssayPreview {
  targetTaskId: string
  sourceId: string
  html: string
  changes: string
  createdAt: string
}

export type PreviewMap = Record<string, EssayPreview>

function previewsKey(userId: string) {
  return `aipply-essay-previews-${userId}`
}

export function loadPreviews(userId: string): PreviewMap {
  try {
    const raw = window.localStorage.getItem(previewsKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function savePreviews(userId: string, previews: PreviewMap) {
  const key = previewsKey(userId)
  const value = JSON.stringify(previews)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

export function putPreview(userId: string, preview: EssayPreview): PreviewMap {
  const next = { ...loadPreviews(userId), [preview.targetTaskId]: preview }
  savePreviews(userId, next)
  return next
}

export function dropPreview(userId: string, targetTaskId: string): PreviewMap {
  const next = { ...loadPreviews(userId) }
  delete next[targetTaskId]
  savePreviews(userId, next)
  return next
}
