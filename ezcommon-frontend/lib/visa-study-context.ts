import { loadColleges } from '@/lib/college-store'
import { SCHOOL_FIT } from '@/lib/school-fit-data'

/**
 * Where the applicant is actually going, in a form a consular officer would
 * recognise.
 *
 * The mock interview used to see only the DS-160 and the profile, and neither
 * of those necessarily names a school - so the officer could not ask "why
 * Duke", which is one of the questions every F-1 applicant is actually asked.
 * The student's college list has known that all along; it simply was not
 * being passed.
 */
export function loadStudyContext(userId: string): string {
  const lines: string[] = []

  try {
    const colleges = loadColleges(userId)
    if (colleges.length) {
      // A submitted application is the strongest signal of where they are
      // heading; otherwise the whole list is context.
      const submitted = colleges.filter((c) => c.submitted)
      const headed = submitted.length ? submitted : colleges
      lines.push('Schools on the applicant’s list:')
      for (const c of headed.slice(0, 12)) {
        const fit = SCHOOL_FIT[c.name]
        const bits = [c.category, c.submitted ? 'application submitted' : null]
          .filter(Boolean)
          .join(', ')
        const place = fit ? `${fit.city}, ${fit.state}` : ''
        const cost = fit?.costPerYear ? `about $${fit.costPerYear}k per year` : ''
        lines.push(`  - ${c.name}${place ? ` (${place})` : ''}${bits ? ` [${bits}]` : ''}${cost ? ` - ${cost}` : ''}`)
      }
      if (submitted.length === 1) {
        const only = submitted[0]
        const fit = SCHOOL_FIT[only.name]
        lines.push(
          `Most likely destination: ${only.name}${fit ? ` in ${fit.city}, ${fit.state}` : ''}. ` +
            (fit?.strongPrograms?.length
              ? `Known for: ${fit.strongPrograms.join(', ')}.`
              : ''),
        )
      }
    }
  } catch {
    /* no college list is not an error - the interview still runs */
  }

  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (raw) {
      const profile = JSON.parse(raw) as Record<string, any>
      const interests = profile['academic-interests']
      if (interests?.intendedMajor) {
        lines.push(`Intended major: ${interests.intendedMajor}`)
      }
      if (interests?.secondChoiceMajor) {
        lines.push(`Second-choice major: ${interests.secondChoiceMajor}`)
      }
    }
  } catch {
    /* same */
  }

  return lines.join('\n')
}
