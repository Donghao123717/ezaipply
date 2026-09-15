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
  const summary: StudentProfileSummary = { ...data, generatedAt: new Date().toISOString() }
  saveStudentProfile(userId, summary)
  return summary
}
