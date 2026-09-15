import { queueUserStateSync } from '@/lib/user-state-sync'
import type { CollegeCategory } from '@/lib/college-store'

/**
 * A school the AI counselor suggested. These sit in a staging area on the
 * Colleges page - they are not part of the student's application list until
 * the student explicitly moves them over.
 */
export interface RecommendedCollege {
  name: string
  category: CollegeCategory
  rationale: string
  acceptanceRate: number
  /** 0-100 overall fit, computed from scores, programme and stated preferences. */
  fitScore?: number
  /** The dimensions behind the score, so the student can argue with it. */
  reasons?: { label: string; detail: string }[]
  /** 'ED' or 'EA' on the one or two reaches worth an early card. */
  earlyPlan?: string | null
  /** Estimated all-in annual cost, USD thousands. */
  costPerYear?: number
}

export interface RecommendationSet {
  generatedAt: string
  items: RecommendedCollege[]
}

function recommendationsKey(userId: string) {
  return `aipply-recommendations-${userId}`
}

export function loadRecommendations(userId: string): RecommendationSet | null {
  try {
    const raw = window.localStorage.getItem(recommendationsKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveRecommendations(userId: string, set: RecommendationSet | null) {
  const key = recommendationsKey(userId)
  if (!set) {
    window.localStorage.removeItem(key)
    queueUserStateSync(key, null)
    return
  }
  const value = JSON.stringify(set)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
