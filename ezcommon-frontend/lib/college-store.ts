import { queueUserStateSync } from '@/lib/user-state-sync'

export type CollegeCategory = 'reach' | 'target' | 'safety'

/** Where the application is actually filed. Not every school takes the Common App. */
export type ApplicationPortal = 'commonApp' | 'uc' | 'direct'

/** Which round the student is applying in. */
export type ApplicationCycle = 'ED' | 'ED2' | 'EA' | 'REA' | 'RD'

export interface SavedCollege {
  id: string
  name: string
  category: CollegeCategory
  addedAt: string
  deadline?: string
  /** Snapshot of the school's approximate acceptance rate at add-time, see lib/colleges-database.ts. */
  acceptanceRate?: number
  submitted?: boolean
  /** Which round the student is applying in. Portal isn't stored - it follows
   * from the school itself, see resolvePortal. */
  cycle?: ApplicationCycle
}

export const PORTAL_LABEL_KEY: Record<ApplicationPortal, string> = {
  commonApp: 'submit.portals.commonApp',
  uc: 'submit.portals.ucApplication',
  direct: 'submit.portals.independentPortals',
}

export const CYCLES: ApplicationCycle[] = ['ED', 'ED2', 'EA', 'REA', 'RD']

/**
 * Schools that don't accept the Common App and must be filed elsewhere. The UC
 * campuses share one system-wide application; MIT and Georgetown each run their
 * own. Everything else in lib/colleges-database.ts takes the Common App.
 */
const DIRECT_APPLICATION_SCHOOLS = new Set(['Massachusetts Institute of Technology', 'Georgetown University'])

export function resolvePortal(schoolName: string): ApplicationPortal {
  if (schoolName.startsWith('University of California')) return 'uc'
  if (DIRECT_APPLICATION_SCHOOLS.has(schoolName)) return 'direct'
  return 'commonApp'
}

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
  const key = collegesKey(userId)
  const value = JSON.stringify(colleges)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
