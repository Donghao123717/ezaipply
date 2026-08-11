import { PROFILE_SECTIONS } from '@/lib/profile-schema'
import { loadEssays, wordCount } from '@/lib/essay-store'

/**
 * A 0-1 "how much real signal do we actually have" score, used to anchor
 * forecast estimates (see lib/forecast-store.ts / forecast_api.py) instead
 * of letting an empty profile produce an arbitrary-looking chance.
 */
export function computeProfileStrength(userId: string): number {
  let profileCompleteness = 0
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    const data = raw ? JSON.parse(raw) : {}
    const filledSections = PROFILE_SECTIONS.filter((section) => {
      const value = data[section.key]
      if (!value) return false
      if (Array.isArray(value)) return value.length > 0
      return Object.values(value).some((v) => typeof v === 'string' && v.trim())
    })
    profileCompleteness = filledSections.length / PROFILE_SECTIONS.length
  } catch {
    profileCompleteness = 0
  }

  const essays = loadEssays(userId)
  const essayRecords = Object.values(essays)
  const essaysWithContent = essayRecords.filter((r) => wordCount(r.html) > 50)
  // Having at least one real essay matters more than having many
  const essayCompleteness = essayRecords.length > 0 ? Math.min(essaysWithContent.length / Math.min(essayRecords.length, 2), 1) : 0

  return Math.max(0, Math.min(1, 0.7 * profileCompleteness + 0.3 * essayCompleteness))
}
