import { queueUserStateSync } from '@/lib/user-state-sync'
import { wordCount } from '@/lib/essay-store'

/**
 * A snapshot the student chose to keep. Essays autosave continuously, which is
 * convenient until a rewrite turns out worse than what it replaced - versions
 * are the deliberate checkpoints they can come back to.
 */
export interface EssayVersion {
  id: string
  html: string
  words: number
  savedAt: string
}

export type VersionMap = Record<string, EssayVersion[]>

/** Per task, so one heavily-revised essay can't crowd out the others. */
const MAX_VERSIONS_PER_TASK = 10

function versionsKey(userId: string) {
  return `aipply-essay-versions-${userId}`
}

export function loadVersions(userId: string): VersionMap {
  try {
    const raw = window.localStorage.getItem(versionsKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function save(userId: string, map: VersionMap) {
  const key = versionsKey(userId)
  const value = JSON.stringify(map)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

/** Returns the updated map, or the unchanged one when there's nothing new to keep. */
export function saveVersion(userId: string, taskId: string, html: string): VersionMap {
  const map = loadVersions(userId)
  const existing = map[taskId] || []
  // Saving the same text twice in a row just adds noise to the list.
  if (!html.trim() || existing[0]?.html === html) return map

  const next: VersionMap = {
    ...map,
    [taskId]: [
      {
        id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        html,
        words: wordCount(html),
        savedAt: new Date().toISOString(),
      },
      ...existing,
    ].slice(0, MAX_VERSIONS_PER_TASK),
  }
  save(userId, next)
  return next
}

export function deleteVersion(userId: string, taskId: string, versionId: string): VersionMap {
  const map = loadVersions(userId)
  const next = { ...map, [taskId]: (map[taskId] || []).filter((v) => v.id !== versionId) }
  save(userId, next)
  return next
}
