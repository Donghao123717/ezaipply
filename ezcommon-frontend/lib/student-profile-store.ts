import { apiErrorMessage } from '@/lib/api-error'
import { loadProfileContext } from '@/lib/essay-store'
import { computeStudentScores } from '@/lib/student-scores'

export interface StudentProfileSummary {
  verdict: string
  academic: string[]
  strengths: string[]
  activities: string[]
  growth: string[]
  has_data: boolean
  /** When this read was generated, so the card can say how old it is. */
  generatedAt?: string
  /**
   * Fingerprint of the profile it was built from. The card regenerates when
   * this stops matching - which is what makes it keep itself current without
   * either a button to press or a model call on every page view.
   */
  sourceHash?: string
}

function key(userId: string) {
  return `aipply-student-profile-${userId}`
}

export function loadStudentProfile(userId: string): StudentProfileSummary | null {
  try {
    const raw = window.localStorage.getItem(key(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveStudentProfile(userId: string, summary: StudentProfileSummary | null) {
  try {
    if (summary) window.localStorage.setItem(key(userId), JSON.stringify(summary))
    else window.localStorage.removeItem(key(userId))
  } catch {
    /* a cached read is a convenience, not a record */
  }
}

/**
 * A cheap, stable fingerprint of everything the summary is built from.
 *
 * Not a security hash - just enough that editing an activity or adding a score
 * changes it, and opening the page twice does not.
 */
function fingerprint(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return `${input.length}-${h}`
}

/** Everything the summary depends on, as one string. */
export function profileFingerprint(userId: string): string {
  const scores = computeStudentScores(userId)
  let extras = ''
  try {
    extras = window.localStorage.getItem(`aipply-profile-${userId}`) || ''
  } catch {
    extras = ''
  }
  return fingerprint(
    [scores.sat, scores.act, scores.gpa4, extras].map((x) => String(x ?? '')).join('|'),
  )
}

/** True when there is enough in the profile to be worth summarising. */
export function hasProfileData(userId: string): boolean {
  const scores = computeStudentScores(userId)
  if (scores.sat || scores.act || scores.gpa4) return true
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (!raw) return false
    const profile = JSON.parse(raw) as Record<string, any>
    // A name alone is not a profile; look for something with substance in it.
    return ['activities', 'honors', 'education', 'academic-interests'].some((key) => {
      const value = profile[key]
      if (Array.isArray(value)) return value.length > 0
      return !!value && Object.values(value).some((v) => String(v ?? '').trim())
    })
  } catch {
    return false
  }
}

/** Pull one profile section back out as readable lines for the prompt. */
function sectionContext(userId: string, sectionKey: string): string {
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (!raw) return ''
    const value = (JSON.parse(raw) as Record<string, any>)[sectionKey]
    if (!Array.isArray(value)) return ''
    return value
      .map((item) =>
        Object.entries(item)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
      )
      .filter(Boolean)
      .join('\n')
  } catch {
    return ''
  }
}

export async function generateStudentProfile(
  userId: string,
  locale: string,
): Promise<StudentProfileSummary> {
  const scores = computeStudentScores(userId)
  let intendedMajor = ''
  let classRank = ''
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (raw) {
      const profile = JSON.parse(raw) as Record<string, any>
      intendedMajor = profile['academic-interests']?.intendedMajor || ''
      classRank = profile['education']?.classRank || ''
    }
  } catch {
    /* fall through with what we have */
  }

  const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
  const res = await fetch(`${base}/api/counselor/student-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_context: loadProfileContext(userId),
      gpa: scores.gpa4 ?? null,
      class_rank: classRank,
      sat: scores.sat ?? null,
      act: scores.act ?? null,
      intended_major: intendedMajor,
      activities_context: sectionContext(userId, 'activities'),
      honors_context: sectionContext(userId, 'honors'),
      locale,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(apiErrorMessage(data, 'Could not build your profile'))
  const summary: StudentProfileSummary = {
    ...data,
    generatedAt: new Date().toISOString(),
    sourceHash: profileFingerprint(userId),
  }
  saveStudentProfile(userId, summary)
  return summary
}
