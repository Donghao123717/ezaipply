import { loadProfileData } from '@/lib/profile-schema'

export interface StudentScores {
  sat?: number
  act?: number
  /** Cumulative GPA normalized to a 4.0 unweighted scale - a directional conversion, not a certified recalculation. */
  gpa4?: number
}

const GPA_SCALE_MAX: Record<string, number> = {
  '4.0': 4.0,
  '4.3': 4.3,
  '4.5': 4.5,
  '5.0': 5.0,
  '100-point': 100,
}

function bestScoreFor(testType: string, records: Record<string, string>[]): number | undefined {
  const matches = records.filter((r) => r.testType === testType && r.score)
  if (matches.length === 0) return undefined
  const scores = matches.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n) && n > 0)
  return scores.length ? Math.max(...scores) : undefined
}

/**
 * Reads the student's saved Profile data and extracts a normalized, directional
 * snapshot of their best SAT/ACT score and unweighted-4.0-scale GPA, for
 * comparing against a school's admissions ranges in the forecast algorithm.
 * Returns an empty object (never throws) if the profile has no test/GPA data yet.
 */
export function computeStudentScores(userId: string): StudentScores {
  const data = loadProfileData(userId)
  const testing = data['testing']
  const records = Array.isArray(testing) ? (testing as Record<string, string>[]) : []

  const sat = bestScoreFor('SAT', records)
  const act = bestScoreFor('ACT', records)

  const education = data['education']
  const educationData = Array.isArray(education) ? undefined : (education as Record<string, string> | undefined)
  const rawGpa = educationData?.cumulativeGPA ? Number(educationData.cumulativeGPA) : undefined
  const scaleMax = educationData?.gpaScale ? GPA_SCALE_MAX[educationData.gpaScale] : undefined
  const gpa4 =
    rawGpa && !Number.isNaN(rawGpa) && scaleMax ? Math.min(4.0, (rawGpa / scaleMax) * 4.0) : rawGpa && !Number.isNaN(rawGpa) && rawGpa <= 4.0 ? rawGpa : undefined

  return { sat, act, gpa4 }
}
