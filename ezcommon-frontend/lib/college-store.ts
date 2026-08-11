export type CollegeCategory = 'reach' | 'target' | 'safety'

export interface SavedCollege {
  id: string
  name: string
  category: CollegeCategory
  addedAt: string
  deadline?: string
  /** Snapshot of the school's approximate acceptance rate at add-time, see lib/colleges-database.ts. */
  acceptanceRate?: number
  submitted?: boolean
}

/** Every saved school is assumed to apply through the Common App for this demo. */
export const PORTAL_LABEL = 'Common App'

/** Dictionary key for each category, resolved via useT() - see lib/i18n/dictionary.ts "common.category". */
export const CATEGORY_LABEL_KEY: Record<CollegeCategory, string> = {
  reach: 'common.category.reach',
  target: 'common.category.target',
  safety: 'common.category.safety',
}

function collegesKey(userId: string) {
  return `aipply-colleges-${userId}`
}

export function loadColleges(userId: string): SavedCollege[] {
  try {
    const raw = window.localStorage.getItem(collegesKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveColleges(userId: string, colleges: SavedCollege[]) {
  window.localStorage.setItem(collegesKey(userId), JSON.stringify(colleges))
}
