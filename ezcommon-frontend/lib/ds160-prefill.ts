import { DS160_SECTIONS } from '@/lib/ds160-schema'
import type { Ds160Data } from '@/lib/ds160-store'

/**
 * Carries what the student has already told us into the DS-160.
 *
 * The DS-160 asks for ~196 fields, and a large share of them - legal name, sex,
 * date and place of birth, nationality, passport, home address, phone, email,
 * current school - are things the profile already holds. Re-asking for them
 * turns this module into a second copy of the government form, which is exactly
 * the work the product exists to remove.
 *
 * Two rules, both load-bearing:
 *
 * - Never overwrite. A value the student has typed or corrected here always
 *   wins over the profile, because the DS-160 is the legal document and their
 *   correction is the deliberate act.
 * - Never touch the security sections. Nothing in a profile answers whether
 *   someone has committed genocide, and a wrong guess there is not a typo.
 */

/** profile section -> profile field -> DS-160 section -> DS-160 field. */
const MAP: { from: [section: string, field: string]; to: [section: string, field: string] }[] = [
  // Identity
  { from: ['personal-info', 'lastName'], to: ['personal1', 'surnames'] },
  { from: ['personal-info', 'firstName'], to: ['personal1', 'givenNames'] },
  { from: ['personal-info', 'sex'], to: ['personal1', 'sex'] },
  { from: ['personal-info', 'dob'], to: ['personal1', 'dob'] },
  { from: ['personal-info', 'birthCity'], to: ['personal1', 'birthCity'] },
  { from: ['personal-info', 'birthState'], to: ['personal1', 'birthState'] },
  { from: ['personal-info', 'birthCountry'], to: ['personal1', 'birthCountry'] },
  { from: ['personal-info', 'citizenshipCountry'], to: ['personal1', 'nationality'] },

  // Passport
  { from: ['personal-info', 'passportNumber'], to: ['passport', 'documentNumber'] },
  { from: ['personal-info', 'passportIssuanceCountry'], to: ['passport', 'issuingCountry'] },
  { from: ['personal-info', 'passportIssuanceDate'], to: ['passport', 'issuanceDate'] },
  { from: ['personal-info', 'passportExpirationDate'], to: ['passport', 'expirationDate'] },

  // Address and contact
  { from: ['personal-info', 'address'], to: ['addressPhone', 'homeStreetAddress1'] },
  { from: ['personal-info', 'country'], to: ['addressPhone', 'homeCountry'] },
  { from: ['personal-info', 'preferredPhoneNumber'], to: ['addressPhone', 'primaryPhone'] },
  { from: ['personal-info', 'alternatePhoneNumber'], to: ['addressPhone', 'secondaryPhone'] },

  // Present education - the DS-160 treats a student's school as their occupation
  { from: ['education', 'schoolName'], to: ['presentWork', 'employerOrSchoolName'] },
]

/** Profile fields that imply a DS-160 answer rather than copying straight across. */
const DERIVED: {
  to: [section: string, field: string]
  derive: (profile: Record<string, any>) => string | undefined
}[] = [
  {
    // The DS-160 asks what you do; a student in secondary or university is a student.
    to: ['presentWork', 'occupation'],
    derive: (p) => (p['education']?.schoolName ? 'STUDENT' : undefined),
  },
  {
    to: ['addressPhone', 'email'],
    derive: (p) => p['personal-info']?.email || p['family']?.email || undefined,
  },
]

export interface PrefillResult {
  data: Ds160Data
  /** How many DS-160 fields this filled, for the "we filled N for you" note. */
  filled: number
  /** Which sections were touched, so the UI can point at them. */
  sections: string[]
}

/** Where the record of profile-sourced fields lives inside the DS-160 data. */
export const PREFILLED_KEY = '_prefilled'

/** "section.field" for every value that came from the profile, not the student. */
export function prefilledFields(data: Ds160Data): Set<string> {
  const map = (data[PREFILLED_KEY] as Record<string, string>) || {}
  return new Set(Object.keys(map))
}

/**
 * Forget a field once the student edits it. After that the value is theirs and
 * should not carry a "from your profile" marker.
 */
export function clearPrefillMark(data: Ds160Data, sectionKey: string, fieldKey: string): Ds160Data {
  const map = (data[PREFILLED_KEY] as Record<string, string>) || {}
  const path = `${sectionKey}.${fieldKey}`
  if (!(path in map)) return data
  const next = { ...map }
  delete next[path]
  return { ...data, [PREFILLED_KEY]: next }
}

const SECURITY_SECTIONS = ['security1', 'security2', 'security3', 'security4', 'security5']

export function prefillFromProfile(data: Ds160Data, profile: Record<string, any>): PrefillResult {
  const next: Ds160Data = { ...data }
  const marks: Record<string, string> = { ...((data[PREFILLED_KEY] as Record<string, string>) || {}) }
  const touched = new Set<string>()
  let filled = 0

  function put(sectionKey: string, fieldKey: string, value: unknown) {
    if (SECURITY_SECTIONS.includes(sectionKey)) return
    if (value === undefined || value === null || String(value).trim() === '') return
    const existing = next[sectionKey]
    if (Array.isArray(existing)) return
    const section = { ...((existing as Record<string, string>) || {}) }
    const current = section[fieldKey]
    if (current !== undefined && String(current).trim() !== '') {
      // Already filled. If it still matches the profile exactly then it is
      // profile-sourced whether or not we recorded that at the time, so mark
      // it - this heals data written before the marker existed. If it differs,
      // the student edited it and it is theirs.
      if (String(current) === String(value)) marks[`${sectionKey}.${fieldKey}`] = 'true'
      return
    }
    section[fieldKey] = String(value)
    next[sectionKey] = section
    marks[`${sectionKey}.${fieldKey}`] = 'true'
    touched.add(sectionKey)
    filled += 1
  }

  for (const { from, to } of MAP) {
    const sec = profile[from[0]]
    if (!sec || Array.isArray(sec)) continue
    put(to[0], to[1], sec[from[1]])
  }
  for (const { to, derive } of DERIVED) {
    put(to[0], to[1], derive(profile))
  }

  next[PREFILLED_KEY] = marks
  return { data: next, filled, sections: [...touched] }
}

/** Every DS-160 field a profile could ever supply, for the coverage note. */
export const PREFILLABLE_FIELD_COUNT = MAP.length + DERIVED.length

/** Total DS-160 fields, so the UI can say "N of M". */
export function totalDs160Fields(): number {
  let n = 0
  for (const section of DS160_SECTIONS) {
    if (section.def.kind !== 'simple') continue
    n += section.def.groups.flatMap((g) => g.fields).length
  }
  return n
}
