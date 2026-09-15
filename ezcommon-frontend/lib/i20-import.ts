import { loadDS160Data, saveDS160Data } from '@/lib/ds160-store'
import { apiErrorMessage } from '@/lib/api-error'

export interface ParsedI20 {
  sevis_id: string
  school_name: string
  school_address: string
  course_of_study: string
  degree_level: string
  program_start: string
  program_end: string
  estimated_annual_cost: string
  funding_source: string
  student_name: string
  found: boolean
  note: string
}

/** Which DS-160 field each I-20 field lands in, and its label for the receipt. */
const TARGETS: { key: keyof ParsedI20; section: string; field: string; label: string }[] = [
  { key: 'sevis_id', section: 'sevisSchool', field: 'sevisId', label: 'SEVIS ID' },
  { key: 'school_name', section: 'sevisSchool', field: 'schoolName', label: 'School' },
  { key: 'school_address', section: 'sevisSchool', field: 'schoolAddress', label: 'School address' },
  { key: 'course_of_study', section: 'sevisSchool', field: 'courseOfStudy', label: 'Course of study' },
]

export async function parseI20(userId: string, filename: string): Promise<ParsedI20> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
  const res = await fetch(`${base}/api/visa/parse-i20`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, filename }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(apiErrorMessage(data, 'Could not read the I-20'))
  return data as ParsedI20
}

/**
 * Copy what the I-20 says into the DS-160, and report what was copied.
 *
 * Existing answers are never overwritten. The student may have typed something
 * deliberately, and a document read by a model is not grounds to silently
 * replace it - the same rule the profile prefill already follows. Only empty
 * fields get filled, and the caller is told which, so nothing lands invisibly
 * in a form the applicant signs under penalty of perjury.
 */
export function applyI20ToDS160(userId: string, parsed: ParsedI20): { label: string; value: string }[] {
  const data = loadDS160Data(userId)
  const filled: { label: string; value: string }[] = []

  for (const target of TARGETS) {
    const value = String(parsed[target.key] || '').trim()
    if (!value) continue
    const section = (data[target.section] as Record<string, string>) || {}
    if (Array.isArray(section)) continue
    if (section[target.field]?.trim()) continue
    section[target.field] = value
    data[target.section] = section
    filled.push({ label: target.label, value })
  }

  if (filled.length) saveDS160Data(userId, data)
  return filled
}
