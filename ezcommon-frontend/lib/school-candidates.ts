import { COLLEGES_DATABASE } from '@/lib/colleges-database'
import { SCHOOL_ADMISSIONS_DATA } from '@/lib/school-admissions-data'
import { SCHOOL_FIT, classSizeFeel, climateOf } from '@/lib/school-fit-data'

/**
 * Everything the recommender needs to know about every school, in one payload.
 *
 * The data files live here on the frontend, so the backend is sent the facts
 * rather than keeping a second copy that drifts. It also means the ranking can
 * be explained against exactly the numbers the UI is showing the student.
 */
export interface CandidatePayload {
  name: string
  acceptance_rate: number
  us_news_rank: number | null
  sat_mid: number | null
  sat_range_known: boolean
  region: string
  setting: string
  climate: string
  coastal: boolean
  undergrad: number
  class_size_feel: string
  cost_per_year: number
  outcome: string
  merit_aid: string
  strong_programs: string[]
  has_ed: boolean
  has_ea: boolean
}

export function buildCandidates(): CandidatePayload[] {
  return COLLEGES_DATABASE.map((c) => {
    const admissions = SCHOOL_ADMISSIONS_DATA[c.name]
    const fit = SCHOOL_FIT[c.name]
    const satRange = admissions?.satRange
    return {
      name: c.name,
      acceptance_rate: admissions?.acceptanceRate ?? c.acceptanceRate,
      us_news_rank: c.usNewsRank ?? null,
      // A published range is worth more than a guess from the admit rate, so
      // the backend is told which of the two it is holding.
      sat_mid: satRange ? Math.round((satRange[0] + satRange[1]) / 2) : null,
      sat_range_known: !!satRange,
      region: fit?.region ?? '',
      setting: fit?.setting ?? '',
      climate: fit ? climateOf(fit.state) : '',
      coastal: fit?.coastal ?? false,
      undergrad: fit?.undergrad ?? 0,
      class_size_feel: fit ? classSizeFeel(fit) : '',
      cost_per_year: fit?.costPerYear ?? 0,
      outcome: fit?.outcome ?? '',
      merit_aid: fit?.meritAid ?? '',
      strong_programs: fit?.strongPrograms ?? [],
      has_ed: !!admissions?.deadlines?.ed,
      has_ea: !!admissions?.deadlines?.ea,
    }
  })
}
