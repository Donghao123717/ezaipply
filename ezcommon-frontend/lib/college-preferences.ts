import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * What the student wants from a school, beyond being admitted to it.
 *
 * Every field is optional and means "not asked" when absent. That distinction
 * matters in the ranking: an unanswered question is skipped, never scored as a
 * mismatch, so a student who has not said where they want to live does not
 * quietly lose every school in the Midwest.
 *
 * Scores and subject strength still decide most of the list. These answers
 * choose between schools that already fit academically - which is the order a
 * counsellor would work in too.
 */
export interface CollegePreferences {
  intendedMajor?: string
  /** All-in annual budget ceiling, USD thousands. */
  budgetPerYear?: number
  needsScholarship?: boolean
  classSize?: 'small' | 'large'
  afterGraduation?: 'work' | 'masters' | 'phd'
  climate?: 'warm' | 'cold-ok'
  regions?: string[]
  coastal?: 'coast' | 'inland'
  setting?: 'big-city' | 'college-town'
}

function key(userId: string) {
  return `aipply-college-preferences-${userId}`
}

export function loadPreferences(userId: string): CollegePreferences {
  try {
    const raw = window.localStorage.getItem(key(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function savePreferences(userId: string, prefs: CollegePreferences) {
  try {
    const serialised = JSON.stringify(prefs)
    window.localStorage.setItem(key(userId), serialised)
    queueUserStateSync(key(userId), serialised)
  } catch {
    /* storage unavailable - the preferences are a convenience, not a record */
  }
}

/** How many of the questions they have answered, for the progress hint. */
export function answeredCount(prefs: CollegePreferences): number {
  return [
    prefs.intendedMajor,
    prefs.budgetPerYear,
    prefs.needsScholarship !== undefined ? true : undefined,
    prefs.classSize,
    prefs.afterGraduation,
    prefs.climate,
    prefs.regions?.length ? true : undefined,
    prefs.coastal,
    prefs.setting,
  ].filter(Boolean).length
}

export const PREFERENCE_QUESTION_COUNT = 9

/** Wire format for the recommender. */
export function toRequestShape(prefs: CollegePreferences) {
  return {
    intended_major: prefs.intendedMajor || '',
    budget_per_year: prefs.budgetPerYear ?? null,
    needs_scholarship: prefs.needsScholarship ?? null,
    class_size: prefs.classSize ?? null,
    after_graduation: prefs.afterGraduation ?? null,
    climate: prefs.climate ?? null,
    regions: prefs.regions ?? [],
    coastal: prefs.coastal ?? null,
    setting: prefs.setting ?? null,
  }
}
