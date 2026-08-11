/**
 * Flattens the student's Aipply data (Profile, Colleges, Essays) into a
 * simple field-name -> value dictionary the browser extension can use for
 * generic label-based autofill (see browser-extension/content.js). Keys are
 * written as plain, common-sense labels since the extension fuzzy-matches
 * against whatever label text it finds on the actual page - it does not
 * know Aipply's internal field keys.
 */
export function buildAutofillExport(userId: string): Record<string, string> {
  const fields: Record<string, string> = {}

  function set(label: string, value: unknown) {
    if (value === undefined || value === null) return
    const str = String(value).trim()
    if (str) fields[label] = str
  }

  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    const profile = raw ? JSON.parse(raw) : {}

    const personal = profile.personal || {}
    set('First Name', personal.firstName)
    set('Legal First Name', personal.firstName)
    set('Last Name', personal.lastName)
    set('Legal Last Name', personal.lastName)
    set('Email', personal.email)
    set('Phone', personal.phone)
    set('Phone Number', personal.phone)
    set('Date of Birth', personal.dob)
    set('Gender', personal.gender)
    set('Sex', personal.sex)
    set('Pronouns', personal.pronouns)
    set('Race', personal.race)
    set('Ethnicity', personal.race)
    set('Address', personal.address)
    set('Home Address', personal.address)
    set('City', personal.city)
    set('State', personal.state)
    set('Zip', personal.zip)
    set('Zip Code', personal.zip)

    const education = profile.education || {}
    set('High School', education.schoolName)
    set('School Name', education.schoolName)
    set('School Address', education.schoolAddress)
    set('Graduation Date', education.graduationDate)
    set('Class Rank', education.classRank)
    set('GPA', education.gpaUnweighted)
    set('Unweighted GPA', education.gpaUnweighted)
    set('Weighted GPA', education.gpaWeighted)
    set('GPA Scale', education.gpaScale)

    const academic = profile['academic-interests'] || {}
    set('Intended Major', academic.intendedMajor)
    set('Major', academic.intendedMajor)

    const testing: Array<Record<string, string>> = profile.testing || []
    const sat = testing.find((t) => t.test === 'SAT')
    if (sat) set('SAT Score', sat.score)
    const act = testing.find((t) => t.test === 'ACT')
    if (act) set('ACT Score', act.score)

    const activities: Array<Record<string, string>> = profile.activities || []
    if (activities.length) {
      set(
        'Activities',
        activities.map((a) => [a.name, a.role].filter(Boolean).join(' - ')).join('; '),
      )
    }

    const honors: Array<Record<string, string>> = profile.honors || []
    if (honors.length) {
      set('Honors', honors.map((h) => h.title).filter(Boolean).join('; '))
      set('Awards', honors.map((h) => h.title).filter(Boolean).join('; '))
    }

    const family = profile.family || {}
    set('Parent 1 Name', family.p1Name)
    set('Parent 1 Occupation', family.p1Occupation)
    set('Parent 2 Name', family.p2Name)
    set('Parent 2 Occupation', family.p2Occupation)
  } catch {
    // no profile saved yet - leave fields empty
  }

  try {
    const collegesRaw = window.localStorage.getItem(`aipply-colleges-${userId}`)
    const colleges = collegesRaw ? JSON.parse(collegesRaw) : []
    if (colleges.length) {
      set('College List', colleges.map((c: { name: string }) => c.name).join('; '))
    }
  } catch {
    // no colleges saved yet
  }

  try {
    const essaysRaw = window.localStorage.getItem(`aipply-essays-${userId}`)
    const essays = essaysRaw ? JSON.parse(essaysRaw) : {}
    const personalEssay = essays['personal-essay']
    if (personalEssay?.html) {
      const text = personalEssay.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text) {
        set('Personal Essay', text)
        set('Personal Statement', text)
      }
    }
  } catch {
    // no essays saved yet
  }

  return fields
}
