import { DS160_SECTIONS } from '@/lib/ds160-schema'
import { fieldLabel } from '@/lib/profile-schema'
import { loadDS160Data, saveDS160Data, type Ds160Data } from '@/lib/ds160-store'
import { apiErrorMessage } from '@/lib/api-error'
import type { VisaDocKind } from '@/lib/visa-documents'

/**
 * Which parts of the DS-160 each document can actually answer.
 *
 * Sending all two hundred and thirty-one fields at every upload would cost a
 * fortune in tokens and invite the model to find a passport number on a hotel
 * booking. A passport answers the passport page and half of Personal
 * Information; an itinerary answers the travel page; a bank statement answers
 * none of it and is collected for the interview and the risk review instead.
 *
 * "section.*" means the whole page.
 */
const READS: Partial<Record<VisaDocKind, string[]>> = {
  passport: [
    'passport.*',
    'personal1.surnames',
    'personal1.givenNames',
    'personal1.sex',
    'personal1.dob',
    'personal1.birthCity',
    'personal1.birthCountry',
    'personal1.nationality',
  ],
  nationalId: [
    'personal1.nationalIdNumber',
    'personal1.fullNameNativeAlphabet',
    'personal1.dob',
    'personal1.sex',
    'personal1.birthCity',
  ],
  previousVisa: ['previousTravel.hasPriorVisa', 'previousTravel.lastVisaDate', 'previousTravel.visaNumber'],
  familyInfo: ['addressPhone.homeStreetAddress1', 'addressPhone.homeCity', 'addressPhone.homeStateProvince', 'addressPhone.homeCountry'],
  employment: ['presentWork.*'],
  travelPlan: ['travel.*'],
  hotelBooking: ['travel.stayStreetAddress1', 'travel.stayStreetAddress2', 'travel.stayCity', 'travel.stayState', 'travel.stayZip'],
  i20: ['sevisSchool.*', 'travel.purposeClass', 'travel.specify'],
  admissionLetter: ['sevisSchool.schoolName', 'sevisSchool.courseOfStudy', 'sevisSchool.schoolAddress'],
  h1bApproval: ['presentWork.employerOrSchoolName', 'usContact.organizationName', 'usContact.address', 'usContact.phone'],
  jobOffer: ['presentWork.*'],
  employerLetter: ['presentWork.*'],
}

export interface DocTarget {
  section: string
  field: string
  label: string
  type: string
  options: string[]
  required: boolean
  help: string
}

/** The fields this document could fill that are still blank. */
export function targetsFor(kind: VisaDocKind, data: Ds160Data, t: (key: string) => string): DocTarget[] {
  const patterns = READS[kind]
  if (!patterns) return []
  const wholePages = new Set(patterns.filter((p) => p.endsWith('.*')).map((p) => p.slice(0, -2)))
  const exact = new Set(patterns.filter((p) => !p.endsWith('.*')))
  const out: DocTarget[] = []

  for (const section of DS160_SECTIONS) {
    if (section.def.kind !== 'simple') continue
    const inPage = wholePages.has(section.key)
    const sectionData = (data[section.key] as Record<string, any>) || {}
    for (const group of section.def.groups) {
      for (const field of group.fields) {
        if (!inPage && !exact.has(`${section.key}.${field.key}`)) continue
        // Never offer to overwrite: a value the applicant typed deliberately is
        // not up for revision by a model reading a scan.
        const current = sectionData[field.key]
        if (typeof current === 'string' ? current.trim() !== '' : current != null) continue
        out.push({
          section: section.key,
          field: field.key,
          label: fieldLabel(field, t),
          type: field.type || 'text',
          options: field.options || [],
          required: !!field.required,
          help: field.help || '',
        })
      }
    }
  }
  return out
}

/**
 * Read one uploaded document and put what it shows into the DS-160.
 *
 * Returns what was filled so the applicant can be told. Nothing lands silently
 * in a form they sign - the same rule the I-20 import has always followed, now
 * applied to every document.
 */
export async function importDocument(
  userId: string,
  kind: VisaDocKind,
  storedFilename: string,
  t: (key: string) => string,
): Promise<{ label: string; value: string }[]> {
  const data = loadDS160Data(userId)
  const targets = targetsFor(kind, data, t)
  if (targets.length === 0) return []

  const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
  const res = await fetch(`${base}/api/visa/parse-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, filename: storedFilename, kind, targets }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not read that document'))

  const filled: { label: string; value: string }[] = []
  const next: Ds160Data = { ...data }
  for (const fill of body.fills || []) {
    const target = targets.find((x) => x.section === fill.section && x.field === fill.field)
    if (!target) continue
    const sectionData = { ...((next[fill.section] as Record<string, any>) || {}) }
    if (sectionData[fill.field]) continue
    sectionData[fill.field] = fill.value
    next[fill.section] = sectionData
    filled.push({ label: target.label, value: fill.value })
  }
  if (filled.length) saveDS160Data(userId, next)
  return filled
}
