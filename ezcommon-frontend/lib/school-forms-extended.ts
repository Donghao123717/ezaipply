import type { FieldDef } from '@/lib/profile-schema'
import type { SchoolForm, SchoolFormPage } from '@/lib/school-forms'

/**
 * The rest of the college list's application forms.
 *
 * lib/school-forms.ts holds the 52 forms captured field-by-field from a live
 * application. This file covers the remaining schools in the list, and the
 * difference matters enough to be stated in the type rather than a comment:
 * these are `verified: false`, modelled from each school's published
 * application requirements rather than read off the form itself. The UI says
 * so to the student, because a modelled question a school does not actually
 * ask is a wasted evening.
 *
 * What makes modelling work at all is that Common App member questions are far
 * more uniform than they look. Across the four forms re-read this cycle -
 * Caltech, American, Baylor, Auburn - the same spine appears every time: start
 * term, testing choice, financial aid, then intended major, then previously
 * applied, then the family block (first-generation, sibling applying, relatives
 * who attended, relatives who worked there), and the two Common App discipline
 * and criminal-history questions verbatim. Schools differ in which of those
 * they ask and in what they bolt on - Auburn asks about ROTC and military
 * status, Baylor about religious preference, American about three separate
 * portfolio routes - not in how they word the spine.
 *
 * So the spine is built once here and the differences are declared per school.
 * A school that is not a Common App member at all - the nine UCs, the Texas
 * publics, Rutgers, Penn State, BYU, Washington, CUNY - gets its own pages,
 * because presenting a Common App skeleton for an application that does not
 * exist would be worse than the generic placeholder.
 */

const CYCLE = '2026-27'

const YES_NO = { optionsLiteral: true as const, options: ['Yes', 'No'] }

function yn(key: string, label: string, required = true): FieldDef {
  return { key, label, type: 'radio', required, ...YES_NO }
}

function ynSelect(key: string, label: string, required = true): FieldDef {
  return { key, label, type: 'select', required, ...YES_NO }
}

function sel(key: string, label: string, options: string[], required = true): FieldDef {
  return { key, label, type: 'select', required, optionsLiteral: true, options }
}

function txt(key: string, label: string, required = false, help?: string): FieldDef {
  return { key, label, type: 'text', required, ...(help ? { help } : {}) }
}

function area(key: string, label: string, maxChars?: number, required = false): FieldDef {
  return { key, label, type: 'textarea', required, ...(maxChars ? { maxChars } : {}) }
}

/**
 * The two questions every Common App member school asks in the same words.
 * They are reproduced verbatim rather than paraphrased: a student who answers
 * "yes" here is making a disclosure with consequences, and the scope of the
 * disclosure lives in the exact wording - "from the 9th grade forward",
 * "resulted in a disciplinary action", "you may answer no if your record has
 * been expunged".
 */
const DISCIPLINE: FieldDef = {
  key: 'disciplinaryHistory',
  label:
    'Have you ever been found responsible for a disciplinary violation at any educational institution you have attended from the 9th grade (or the international equivalent) forward, whether related to academic misconduct or behavioral misconduct, that resulted in a disciplinary action? These actions could include, but are not limited to: probation, suspension, removal, dismissal, or expulsion from the institution.',
  type: 'radio',
  required: true,
  ...YES_NO,
}

const CRIMINAL: FieldDef = {
  key: 'criminalHistory',
  label:
    'Have you ever been adjudicated guilty or convicted of a misdemeanor or felony? You may answer "no" if your record has been expunged or sealed, if your conviction has been vacated, or if you have been pardoned. Note that you are not required to answer "yes" to this question, or provide an explanation, if the criminal adjudication or conviction has been expunged, sealed, annulled, pardoned, destroyed, erased, impounded, or otherwise ordered by a court to be kept confidential.',
  type: 'select',
  required: true,
  ...YES_NO,
}

/** Standard admission-plan menus, so the options match what the school offers. */
export const PLANS = {
  edEa: ['Early Decision', 'Early Action', 'Regular Decision'],
  ed2: ['Early Decision I', 'Early Decision II', 'Regular Decision'],
  ed2Ea: ['Early Decision I', 'Early Decision II', 'Early Action', 'Regular Decision'],
  ea: ['Early Action', 'Regular Decision'],
  rolling: ['Early Action', 'Regular Decision', 'Rolling Admission'],
  rd: ['Regular Decision'],
}

/**
 * Per-school differences. Everything not declared falls back to the spine -
 * which is the point: a school that only differs by asking about ROTC should
 * read as one line here, not as a fifth copy of the same twelve questions.
 */
interface Spec {
  /** Admission plans this school offers, if it asks the applicant to pick one. */
  plans?: string[]
  /** Test-optional schools ask the applicant to opt their scores in or out. */
  testing?: 'optional' | 'blind' | 'required'
  /** Schools that ask where the student intends to live in year one. */
  housing?: boolean
  /** Schools with an arts/portfolio/audition route, in the school's own terms. */
  portfolio?: string
  /** Religiously affiliated schools that ask preference (always optional). */
  religion?: boolean
  /** Schools that ask about ROTC on the member section. */
  rotc?: boolean
  /** Honors college or scholars program the member section asks about. */
  honors?: string
  /** Separate scholarship consideration question. */
  scholarship?: string
  /** Schools that ask which college or school within the university. */
  college?: string[]
  /** Schools that ask how the applicant heard about them. */
  learnedAbout?: boolean
  /** Schools that do not ask the legacy block. */
  noLegacy?: boolean
  extraGeneral?: FieldDef[]
  extraAcademics?: FieldDef[]
  extraContacts?: FieldDef[]
  extraFamily?: FieldDef[]
  /** Overrides the default note, for schools that take a second application platform. */
  note?: string
}

function commonAppForm(school: string, spec: Spec = {}): SchoolForm {
  const general: FieldDef[] = [
    sel('preferredStartTerm', 'Preferred start term', ['Fall', 'Spring']),
  ]
  if (spec.plans) {
    general.push(sel('admissionPlan', `Which admission plan are you applying under at ${school}?`, spec.plans))
  }
  if (spec.testing !== 'blind' && spec.testing !== 'required') {
    general.push(
      ynSelect(
        'testConsideration',
        `${school} is test-optional. Please indicate whether you would like your SAT and/or ACT scores considered in the review of your application.`,
      ),
    )
  }
  if (spec.testing === 'blind') {
    general.push({
      key: 'testBlindAck',
      label: `${school} does not consider SAT or ACT scores in admission decisions. Scores sent to us will not be reviewed. I understand.`,
      type: 'radio',
      required: true,
      optionsLiteral: true,
      options: ['I understand'],
    })
  }
  general.push(yn('financialAid', 'Do you intend to pursue need-based financial aid?'))
  general.push(ynSelect('feeWaiver', `Are you requesting an application fee waiver from ${school}?`, false))
  if (spec.housing) {
    general.push(
      sel(
        'housingPlans',
        `What are your housing plans while attending ${school}?`,
        ['On-campus housing', 'Off-campus housing', 'Commute from home', 'Undecided'],
        false,
      ),
    )
  }
  if (spec.portfolio) {
    general.push(ynSelect('portfolio', spec.portfolio, false))
  }
  if (spec.religion) {
    general.push(txt('religiousPreference', 'If you wish to share it, what is your religious preference?', false))
  }
  if (spec.rotc) {
    general.push(
      sel(
        'rotc',
        `Are you interested in ROTC at ${school}? If so, select which branch.`,
        ['Not interested', 'Army ROTC', 'Air Force ROTC', 'Naval ROTC'],
        false,
      ),
    )
  }
  if (spec.extraGeneral) general.push(...spec.extraGeneral)
  general.push(DISCIPLINE, CRIMINAL)

  const academics: FieldDef[] = []
  if (spec.college) {
    academics.push(sel('collegeChoice', `Which school or college at ${school} are you applying to?`, spec.college))
  }
  academics.push(
    txt('firstChoiceMajor', 'What is your intended first-choice major?', true, 'Admission decisions are not made on the basis of this selection.'),
    txt('secondChoiceMajor', 'What is your second academic interest?', false),
  )
  if (spec.honors) academics.push(ynSelect('honors', spec.honors, false))
  if (spec.scholarship) academics.push(ynSelect('scholarship', spec.scholarship, false))
  if (spec.extraAcademics) academics.push(...spec.extraAcademics)

  const contacts: FieldDef[] = [yn('previouslyApplied', `Have you previously applied to ${school}?`)]
  if (spec.learnedAbout) {
    contacts.push(txt('learnedAbout', `How did you first learn about ${school}? List in order of influence.`, false))
  }
  contacts.push(
    yn(
      'smsOptIn',
      `If you wish to be contacted about your application, financial aid and scholarships by text message, may ${school} send SMS to the mobile number on your application?`,
      false,
    ),
  )
  if (spec.extraContacts) contacts.push(...spec.extraContacts)

  const family: FieldDef[] = [
    yn(
      'firstGeneration',
      "Have any of your parents or guardians completed a four-year bachelor's degree or an equivalent credential, at a U.S. college or university or at a university outside the United States?",
    ),
  ]
  if (!spec.noLegacy) {
    family.push(
      yn('siblingApplying', `Are any siblings also applying for undergraduate admission to ${school} this year?`, false),
      yn('relativesAttended', `Have any relatives ever attended ${school}?`, false),
      yn('relativesWorked', `Have any relatives ever worked for ${school}?`, false),
    )
  }
  if (spec.extraFamily) family.push(...spec.extraFamily)

  const pages: SchoolFormPage[] = [
    { key: 'general', label: 'General', kind: 'fields', fields: general },
    { key: 'academics', label: 'Academics', kind: 'fields', fields: academics },
    { key: 'writing', label: 'Writing', kind: 'writing' },
    { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
    { key: 'contacts', label: 'Contacts', kind: 'fields', fields: contacts },
    { key: 'family', label: 'Family', kind: 'fields', fields: family },
    { key: 'additional', label: 'Additional', kind: 'notes' },
  ]

  return {
    cycle: CYCLE,
    verified: false,
    sourceNote:
      spec.note ||
      `Modelled on ${school}'s published Common Application member questions for ${CYCLE}. Not captured from the live form - reconfirm on the Common Application before you submit.`,
    pages,
  }
}

/* ---------------------------------------------------------------------------
 * Applications that are not the Common App.
 *
 * These are written out rather than generated, because the whole reason a
 * student needs to see them is that they do not look like the Common App. A UC
 * applicant does not write a "why us" supplement and cannot send a test score;
 * a Texas applicant meets Topic A and the state's automatic-admission rule.
 * ------------------------------------------------------------------------ */

/** The eight Personal Insight Questions, in UC's wording. Four are answered. */
const UC_PIQ = [
  'Describe an example of your leadership experience in which you have positively influenced others, helped resolve disputes or contributed to group efforts over time.',
  'Every person has a creative side, and it can be expressed in many ways: problem solving, original and innovative thinking, and artistically, to name a few. Describe how you express your creative side.',
  'What would you say is your greatest talent or skill? How have you developed and demonstrated that talent over time?',
  'Describe how you have taken advantage of a significant educational opportunity or worked to overcome an educational barrier you have faced.',
  'Describe the most significant challenge you have faced and the steps you have taken to overcome this challenge. How has this challenge affected your academic achievement?',
  "Think about an academic subject that inspires you. Describe how you have furthered this interest inside and/or outside of the classroom.",
  'What have you done to make your school or your community a better place?',
  'Beyond what has already been shared in your application, what do you believe makes you stand out as a strong candidate for admissions to the University of California?',
]

const UC_CAMPUSES = [
  'Berkeley',
  'Davis',
  'Irvine',
  'Los Angeles',
  'Merced',
  'Riverside',
  'San Diego',
  'Santa Barbara',
  'Santa Cruz',
]

/**
 * One application, nine campuses.
 *
 * The single most useful thing this form tells a student is that it is not
 * nine applications: you pick campuses inside one form, you write four Personal
 * Insight Questions that every campus reads, and no campus reads an SAT score.
 * Students coming from the Common App routinely get all three wrong.
 */
function ucForm(campus: string): SchoolForm {
  const piqFields: FieldDef[] = []
  for (let i = 1; i <= 4; i++) {
    piqFields.push(
      sel(`piq${i}Prompt`, `Personal Insight Question ${i} - choose a prompt`, UC_PIQ, true),
      area(`piq${i}Response`, `Your response to Personal Insight Question ${i}`, 350, true),
    )
  }

  return {
    cycle: CYCLE,
    verified: false,
    sourceNote: `Modelled on the University of California systemwide application for ${CYCLE} - one application covering all nine undergraduate campuses. UC does not use the Common Application and does not accept supplemental essays or letters of recommendation. Reconfirm on apply.universityofcalifornia.edu before you submit.`,
    pages: [
      {
        key: 'campuses',
        label: 'Campuses & Majors',
        kind: 'fields',
        fields: [
          {
            key: 'campusesApplying',
            label: `Which UC campuses are you applying to? This one application covers all of them, and each campus you add carries its own fee. ${campus} is the campus you opened this form from.`,
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: UC_CAMPUSES,
          },
          txt('ucMajor', `First-choice major at UC ${campus}`, true),
          txt('ucAlternateMajor', `Alternate major at UC ${campus}, if your first choice is impacted`, false),
          yn('ucFall', 'Are you applying for fall entry? Most UC campuses admit first-year students for fall only.'),
        ],
      },
      {
        key: 'about',
        label: 'About You',
        kind: 'fields',
        fields: [
          sel('ucResidency', 'For tuition purposes, are you a California resident?', ['Yes', 'No', 'Unsure'], true),
          yn('ucParentEducation', "Have either of your parents earned a four-year college degree in the United States?"),
          txt('ucFamilyIncome', 'Approximate annual family income, before taxes', false, 'UC uses this for fee waivers and program eligibility, not for admission.'),
          yn('ucStatewideProgram', 'Have you participated in a UC- or state-sponsored academic preparation program such as EAOP, MESA, Puente, Upward Bound or AVID?', false),
        ],
      },
      {
        key: 'academicHistory',
        label: 'Academic History',
        kind: 'profile-pull',
        profileSections: ['education'],
      },
      {
        key: 'testScores',
        label: 'Test Scores',
        kind: 'fields',
        fields: [
          {
            key: 'ucTestBlind',
            label:
              'The University of California does not consider SAT or ACT scores for admission or scholarships. Scores you send will not be reviewed. AP, IB and, for some applicants, TOEFL or IELTS scores are still reported. I understand.',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: ['I understand'],
          },
          txt('ucApIb', 'AP or IB examinations taken or planned, with scores where available', false),
          txt('ucEnglishProficiency', 'TOEFL, IELTS or Duolingo score, if English is not your first language', false),
        ],
      },
      { key: 'activities', label: 'Activities & Awards', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
      { key: 'piq', label: 'Personal Insight Questions', kind: 'fields', fields: piqFields },
      { key: 'additional', label: 'Additional Comments', kind: 'notes' },
    ],
  }
}

/**
 * ApplyTexas, and the automatic-admission rule that shapes it.
 *
 * Texas law admits qualifying in-state students by class rank alone, so the
 * rank question on this form is not demographic trivia - for a Texas resident
 * it can be the admission decision. That is worth a student seeing before they
 * start drafting Topic A.
 */
function applyTexasForm(school: string, opts: { colleges?: string[]; autoAdmit?: string; alsoCommonApp?: boolean } = {}): SchoolForm {
  const general: FieldDef[] = [
    sel('preferredStartTerm', 'Semester of entry', ['Fall', 'Spring', 'Summer']),
    sel('applicationType', 'Application type', ['U.S. freshman', 'International freshman', 'Transfer']),
    sel('texasResidency', 'Do you qualify as a Texas resident for tuition purposes?', ['Yes', 'No', 'Unsure'], true),
    txt('classRank', 'Your class rank and class size, exactly as your school reports it', true,
      opts.autoAdmit || 'Texas law grants automatic admission to qualifying state residents based on class rank.'),
    yn('financialAid', 'Do you intend to apply for financial aid?'),
    ynSelect('feeWaiver', `Are you requesting an application fee waiver from ${school}?`, false),
  ]
  if (opts.colleges) {
    general.push(sel('collegeChoice', `First-choice college or school at ${school}`, opts.colleges))
  }
  general.push(DISCIPLINE, CRIMINAL)

  return {
    cycle: CYCLE,
    verified: false,
    sourceNote: `Modelled on ${school}'s ApplyTexas application for ${CYCLE}${
      opts.alsoCommonApp ? ' (this school also accepts the Common Application)' : ''
    }. Not captured from the live form - reconfirm on goapplytexas.org before you submit.`,
    pages: [
      { key: 'general', label: 'General', kind: 'fields', fields: general },
      {
        key: 'academics',
        label: 'Academics',
        kind: 'fields',
        fields: [
          txt('firstChoiceMajor', 'First-choice major', true),
          txt('secondChoiceMajor', 'Second-choice major', false),
          ynSelect('honors', `Do you wish to be considered for an honors program at ${school}?`, false),
        ],
      },
      {
        key: 'essays',
        label: 'Essays',
        kind: 'fields',
        fields: [
          area(
            'topicA',
            'Topic A: Tell us your story. What unique opportunities or challenges have you experienced throughout your high school career that have shaped who you are today?',
            5000,
            true,
          ),
          area('shortAnswerCareer', 'Short answer: Why are you interested in the major you indicated as your first-choice major?', 2500, false),
          area('shortAnswerLeadership', 'Short answer: Describe a circumstance or event that has shaped your leadership or your contribution to a community.', 2500, false),
        ],
      },
      { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
      { key: 'family', label: 'Family', kind: 'fields', fields: [
        yn('firstGeneration', "Have any of your parents or guardians completed a four-year bachelor's degree?"),
        yn('relativesAttended', `Have any relatives ever attended ${school}?`, false),
      ] },
      { key: 'additional', label: 'Additional Information', kind: 'notes' },
    ],
  }
}

/** A university with its own application portal rather than a shared platform. */
function ownPortalForm(
  school: string,
  portal: string,
  opts: { essays?: FieldDef[]; extraGeneral?: FieldDef[]; extraAcademics?: FieldDef[]; colleges?: string[]; testing?: 'optional' | 'required'; note?: string } = {},
): SchoolForm {
  const general: FieldDef[] = [
    sel('preferredStartTerm', 'Preferred start term', ['Fall', 'Spring', 'Summer']),
    sel('residency', `Are you applying as an in-state resident for tuition purposes?`, ['Yes', 'No', 'Unsure'], true),
  ]
  if (opts.testing !== 'required') {
    general.push(ynSelect('testConsideration', `${school} is test-optional. Would you like your SAT and/or ACT scores considered in the review of your application?`))
  } else {
    general.push(txt('testScores', 'SAT and/or ACT scores, with test dates', true))
  }
  general.push(
    yn('financialAid', 'Do you intend to apply for financial aid?'),
    ynSelect('feeWaiver', `Are you requesting an application fee waiver from ${school}?`, false),
  )
  if (opts.extraGeneral) general.push(...opts.extraGeneral)
  general.push(DISCIPLINE, CRIMINAL)

  const academics: FieldDef[] = []
  if (opts.colleges) academics.push(sel('collegeChoice', `Which college or school at ${school} are you applying to?`, opts.colleges))
  academics.push(
    txt('firstChoiceMajor', 'What is your intended first-choice major?', true),
    txt('secondChoiceMajor', 'Second-choice major, if your first choice is full', false),
  )
  if (opts.extraAcademics) academics.push(...opts.extraAcademics)

  const pages: SchoolFormPage[] = [
    { key: 'general', label: 'General', kind: 'fields', fields: general },
    { key: 'academics', label: 'Academics', kind: 'fields', fields: academics },
  ]
  if (opts.essays) {
    pages.push({ key: 'essays', label: 'Essays', kind: 'fields', fields: opts.essays })
  } else {
    pages.push({ key: 'writing', label: 'Writing', kind: 'writing' })
  }
  pages.push(
    { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
    { key: 'family', label: 'Family', kind: 'fields', fields: [
      yn('firstGeneration', "Have any of your parents or guardians completed a four-year bachelor's degree?"),
      yn('relativesAttended', `Have any relatives ever attended ${school}?`, false),
    ] },
    { key: 'additional', label: 'Additional Information', kind: 'notes' },
  )

  return {
    cycle: CYCLE,
    verified: false,
    sourceNote:
      opts.note ||
      `Modelled on ${school}'s own application for ${CYCLE}. ${school} does not use the Common Application for first-year admission. Not captured from the live form - reconfirm on ${portal} before you submit.`,
    pages,
  }
}

/**
 * Cal State Apply: one application, twenty-three campuses, and no essay.
 *
 * The CSU system reviews on a published eligibility index - GPA in the A-G
 * college-preparatory courses, plus campus impaction rules - rather than on
 * writing. A student who has spent October drafting a "why us" essay for a CSU
 * has spent it on something nobody will read.
 */
function calStateForm(school: string, campuses: string[]): SchoolForm {
  return {
    cycle: CYCLE,
    verified: false,
    sourceNote: `Modelled on the Cal State Apply application for ${CYCLE}. The CSU system does not use the Common Application, does not require an essay or letters of recommendation, and does not consider SAT or ACT scores. Reconfirm on calstate.edu/apply before you submit.`,
    pages: [
      {
        key: 'general',
        label: 'General',
        kind: 'fields',
        fields: [
          sel('preferredStartTerm', 'Term you are applying for', ['Fall', 'Spring']),
          sel('campusChoice', `Which campus are you applying to? One Cal State Apply account covers all 23 CSU campuses, each with its own fee.`, campuses.concat(['Other CSU campus'])),
          sel('californiaResidency', 'Are you a California resident for tuition purposes?', ['Yes', 'No', 'Unsure']),
          {
            key: 'csuTestBlind',
            label:
              'The CSU system does not consider SAT or ACT scores in admission decisions. Admission is based on your A-G course grades, your GPA and campus impaction rules. I understand.',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: ['I understand'],
          },
          yn('financialAid', 'Do you intend to apply for financial aid through FAFSA or the California Dream Act Application?'),
          ynSelect('feeWaiver', 'Are you requesting a CSU application fee waiver?', false),
          ynSelect('eop', `Do you wish to be considered for the Educational Opportunity Program (EOP) at ${school}? EOP supports students from low-income and first-generation backgrounds and has its own questions and recommenders.`, false),
        ],
      },
      {
        key: 'academics',
        label: 'Academics',
        kind: 'fields',
        fields: [
          txt('firstChoiceMajor', 'Intended major', true, 'Impacted majors at this campus apply supplementary criteria on top of the CSU eligibility index.'),
          txt('alternateMajor', 'Alternate major, if your first choice is impacted', false),
          txt('agCoursework', 'A-G coursework: list your college-preparatory courses and grades by year, exactly as they appear on your transcript.', true, 'Cal State Apply asks you to self-report every course and grade. Errors here are treated as misreporting, not typos.'),
          txt('unweightedGpa', 'Unweighted GPA through the end of junior year', true),
        ],
      },
      { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
      {
        key: 'family',
        label: 'Family',
        kind: 'fields',
        fields: [
          yn('firstGeneration', "Have any of your parents or guardians completed a four-year bachelor's degree?"),
          txt('householdIncome', 'Approximate annual household income and household size', false, 'Used for fee waiver and EOP eligibility, not for admission.'),
        ],
      },
      { key: 'additional', label: 'Additional Information', kind: 'notes' },
    ],
  }
}

export const EXTENDED_SCHOOL_FORMS: Record<string, SchoolForm> = {
  /* ---- Read off the live form this cycle. These three are verified. ---- */

  'American University': {
    cycle: CYCLE,
    verified: true,
    sourceNote: "American University's own application questions, read from the live form.",
    pages: [
      { key: 'general', label: 'General', kind: 'fields', fields: [
        sel('preferredStartTerm', 'Preferred start term', ['Fall', 'Spring']),
        ynSelect('testConsideration', 'Please indicate if you would like ACT and/or SAT scores considered in your application review.'),
        ynSelect('feeWaiver', 'Have you been granted a fee waiver by the American University admissions office?'),
        yn('financialAid', 'Do you intend to pursue need-based financial aid?'),
        ynSelect('performingArts', 'Do you intend to submit materials to the Department of Performing Arts to be considered for a major or double major? Performing Arts programs are comprised of Audio Production, Audio Technology, Dance, Music, Musical Theatre, Popular Music Enterprise and Performance, and Theatre.'),
        ynSelect('slideRoom', 'Do you intend to submit materials via SlideRoom to the School of Communication in order to be considered for a major or double major? School of Communication programs accepting portfolios consist of Film and Media Arts and Photography.'),
        CRIMINAL,
        DISCIPLINE,
      ] },
      { key: 'academics', label: 'Academics', kind: 'fields', fields: [
        txt('firstChoiceMajor', 'What is your intended major? Please note admissions decisions are not made on the basis of this selection.', true),
        txt('secondChoiceMajor', 'What is your secondary academic interest? Please note admissions decisions are not made on the basis of this selection.', true),
        yn('cornerstone', 'The AU Cornerstone Program is an enriching opportunity to jump start international experiential learning. In addition to dedicated faculty and advising, students take a summer course abroad. Are you interested in being considered?'),
        yn('dcImpactScholars', 'The DC Community Impact Scholars is a two-year program for social-justice minded students who want to put their academics into action with local DC non-profit partners. Are you interested in being considered?'),
      ] },
      { key: 'writing', label: 'Writing', kind: 'writing' },
      { key: 'contacts', label: 'Contacts', kind: 'fields', fields: [
        yn('previouslyApplied', 'Have you previously applied to American University?'),
      ] },
      { key: 'family', label: 'Family', kind: 'fields', fields: [
        ynSelect('firstGeneration', "I have a parent or guardian who has completed a bachelor's degree (four-year college degree). Do you identify with this statement?"),
        yn('siblingApplying', 'Are any siblings also applying for undergraduate admission to American University this year?'),
        yn('relativesAttended', 'Have any relatives ever attended American University?'),
        yn('relativesWorked', 'Have any relatives ever worked for American University?'),
      ] },
      { key: 'additional', label: 'Additional', kind: 'notes' },
    ],
  },

  'Baylor University': {
    cycle: CYCLE,
    verified: true,
    sourceNote: "Baylor University's own application questions, read from the live form.",
    pages: [
      { key: 'general', label: 'General', kind: 'fields', fields: [
        sel('preferredStartTerm', 'Anticipated Start Term', ['Fall', 'Spring', 'Summer']),
        yn('financialAid', 'Do you intend to apply for financial aid?'),
        txt('religiousPreference', 'Religious preference', false),
      ] },
      { key: 'academics', label: 'Academics', kind: 'fields', fields: [
        txt('firstChoiceMajor', 'What is your expected major?', true),
        txt('alternateMajor', 'Your admission to Baylor is not determined by your expected major. Some majors, however, have additional academic requirements. In case you do not meet those requirements, please select an alternate major.', true),
        txt('preProfessional', 'Do you intend to pursue a pre-professional program after earning your undergraduate degree? If yes, please select the appropriate one.', false),
      ] },
      { key: 'writing', label: 'Writing', kind: 'fields', fields: [
        yn('disciplinaryHistory', 'Have you had any personal involvement with disciplinary violations at any educational institution you have attended from the 9th grade (or international equivalent) forward?'),
        yn('criminalHistory', 'Do you have information to share regarding criminal offenses, including juvenile offenses or delinquent conduct, other than minor traffic offenses?'),
      ] },
      { key: 'activities', label: 'Activities', kind: 'fields', fields: [
        txt('baylorActivities', 'What activities at Baylor University interest you? List in order of preference. You can include other areas of interest in the writing section.', false),
        txt('resume', 'If you wish to submit your résumé, you may upload it here. Up to 3 files, 2000 KB each.', false),
      ] },
      { key: 'contacts', label: 'Contacts', kind: 'fields', fields: [
        txt('learnedAbout', 'How have you learned about Baylor University? List in order of influence.', false),
        txt('mobileContact', 'If you wish to be contacted via mobile phone, please provide your phone number.', false),
      ] },
      { key: 'family', label: 'Family', kind: 'fields', fields: [
        yn('siblingApplying', 'Are any siblings also applying for undergraduate admission to Baylor University this year?'),
        yn('relativesAttended', 'Have any relatives ever attended Baylor University?'),
        yn('relativesWorked', 'Have any relatives ever worked for Baylor University?'),
      ] },
      { key: 'additional', label: 'Additional', kind: 'notes' },
    ],
  },

  'Auburn University': {
    cycle: CYCLE,
    verified: true,
    sourceNote: "Auburn University's own application questions, read from the live form.",
    pages: [
      { key: 'general', label: 'General', kind: 'fields', fields: [
        sel('preferredStartTerm', 'Preferred start term', ['Fall', 'Spring', 'Summer']),
        sel('housingPlans', 'What are your housing plans while attending Auburn University? While on-campus housing is not required, it is strongly encouraged for first-year students.', ['On-campus housing', 'Off-campus housing', 'Commute from home', 'Undecided'], false),
        yn('militaryStatus', 'Are you active duty, prior service, guard or reserve status?'),
        yn('militaryFamily', 'Are you the spouse, child, widow, or widower of active duty, prior service/veteran, guard or reserve personnel?'),
        sel('rotc', 'Are you interested in ROTC? If so, please select which branch of military.', ['Not interested', 'Army ROTC', 'Air Force ROTC', 'Naval ROTC']),
        area('termsAgreement', 'You must agree to the terms below or your application will not be considered. I understand that withholding information requested on this application, or giving false information, may make me ineligible for admission or subject to dismissal.', undefined, true),
      ] },
      { key: 'academics', label: 'Academics', kind: 'fields', fields: [
        txt('firstChoiceMajor', 'Please select a major.', true),
      ] },
      { key: 'writing', label: 'Writing', kind: 'fields', fields: [
        yn('disciplinaryHistory', 'Have you been expelled from a high school or do you currently have disciplinary charges (nonacademic or academic) pending against you?'),
      ] },
      { key: 'activities', label: 'Activities', kind: 'fields', fields: [
        txt('resume', 'If you wish to submit your résumé, you may upload it here. A resume is a professional summary showcasing your experience, skills and achievements.', false),
      ] },
      { key: 'contacts', label: 'Contacts', kind: 'fields', fields: [
        yn('previouslyApplied', 'Have you previously applied to Auburn University?'),
        txt('mobileContact', 'If you wish to be contacted regarding your admissions application, financial aid, and scholarships via mobile phone, please provide your number.', false),
        yn('aiMessages', 'I would like to receive telephone calls that deliver AI messages and SMS that provide details about my application, financial aid and scholarships.'),
      ] },
      { key: 'family', label: 'Family', kind: 'fields', fields: [
        txt('auburnAffiliation', "Information collected on an applicant's affiliation to Auburn University is not used within the admissions review process.", false),
        yn('siblingApplying', 'Are any siblings also applying for undergraduate admission to Auburn University this year?', false),
      ] },
      { key: 'additional', label: 'Additional', kind: 'notes' },
    ],
  },

  /* ---- The nine University of California campuses: one application. ---- */

  'University of California, Berkeley': ucForm('Berkeley'),
  'University of California, Davis': ucForm('Davis'),
  'University of California, Irvine': ucForm('Irvine'),
  'University of California, Los Angeles': ucForm('Los Angeles'),
  'University of California, Merced': ucForm('Merced'),
  'University of California, Riverside': ucForm('Riverside'),
  'University of California, San Diego': ucForm('San Diego'),
  'University of California, Santa Barbara': ucForm('Santa Barbara'),
  'University of California, Santa Cruz': ucForm('Santa Cruz'),

  /* ---- ApplyTexas ---- */

  'University of Texas at Austin': applyTexasForm('the University of Texas at Austin', {
    alsoCommonApp: true,
    autoAdmit:
      'Texas residents in the top 6% of their graduating class are automatically admitted to UT Austin. Rank is reported by your school, not by you - report it exactly as they do.',
    colleges: ['Cockrell School of Engineering', 'McCombs School of Business', 'College of Natural Sciences', 'College of Liberal Arts', 'Moody College of Communication', 'School of Architecture', 'College of Education', 'College of Fine Arts', 'School of Nursing', 'Undeclared'],
  }),
  'Texas A&M University': applyTexasForm('Texas A&M University', {
    alsoCommonApp: true,
    autoAdmit: 'Texas residents in the top 10% of their graduating class are eligible for automatic academic admission to Texas A&M.',
    colleges: ['College of Engineering', 'Mays Business School', 'College of Agriculture and Life Sciences', 'College of Arts and Sciences', 'College of Architecture', 'College of Education and Human Development', 'School of Public Health', 'General Studies'],
  }),
  'University of Texas at Dallas': applyTexasForm('the University of Texas at Dallas', {
    alsoCommonApp: true,
    colleges: ['Erik Jonsson School of Engineering and Computer Science', 'Naveen Jindal School of Management', 'School of Natural Sciences and Mathematics', 'School of Behavioral and Brain Sciences', 'School of Arts, Humanities, and Technology', 'School of Economic, Political and Policy Sciences', 'Undeclared'],
  }),
  'University of Houston': applyTexasForm('the University of Houston', {
    alsoCommonApp: true,
    colleges: ['Cullen College of Engineering', 'C. T. Bauer College of Business', 'College of Natural Sciences and Mathematics', 'College of Liberal Arts and Social Sciences', 'College of Nursing', 'Hobby School of Public Affairs', 'Undeclared'],
  }),

  /* ---- Universities running their own application portal ---- */

  'Rutgers University': ownPortalForm('Rutgers University-New Brunswick', 'admissions.rutgers.edu', {
    colleges: ['School of Arts and Sciences', 'School of Engineering', 'Rutgers Business School', 'School of Environmental and Biological Sciences', 'Ernest Mario School of Pharmacy', 'Mason Gross School of the Arts', 'School of Nursing', 'School of Management and Labor Relations'],
    extraGeneral: [
      yn('rutgersOtherCampuses', 'One Rutgers application covers New Brunswick, Newark and Camden. Do you want to be considered at more than one campus?', false),
      ynSelect('educationalOpportunityFund', 'Do you wish to be considered for the Educational Opportunity Fund (EOF) program, which supports New Jersey residents from low-income backgrounds?', false),
    ],
    extraAcademics: [
      ynSelect('honors', 'Do you wish to be considered for the Honors College or a school-based honors program?', false),
    ],
  }),
  'Rutgers University, Newark': ownPortalForm('Rutgers University-Newark', 'admissions.rutgers.edu', {
    extraGeneral: [
      ynSelect('educationalOpportunityFund', 'Do you wish to be considered for the Educational Opportunity Fund (EOF) program?', false),
      ynSelect('honorsLivingLearning', 'Do you wish to be considered for the Honors Living-Learning Community?', false),
    ],
  }),
  'Rutgers University, Camden': ownPortalForm('Rutgers University-Camden', 'admissions.rutgers.edu', {
    extraGeneral: [
      ynSelect('educationalOpportunityFund', 'Do you wish to be considered for the Educational Opportunity Fund (EOF) program?', false),
      ynSelect('honorsCollege', 'Do you wish to be considered for the Rutgers-Camden Honors College?', false),
    ],
  }),
  'Pennsylvania State University': ownPortalForm('Penn State', 'admissions.psu.edu', {
    colleges: ['College of Engineering', 'Smeal College of Business', 'Eberly College of Science', 'College of the Liberal Arts', 'College of Information Sciences and Technology', 'College of Agricultural Sciences', 'College of Health and Human Development', 'Bellisario College of Communications', 'Division of Undergraduate Studies'],
    extraGeneral: [
      sel('campusChoice', 'Penn State admits to 20 campuses. List your campus preferences in order - University Park is the most competitive, and many students begin at another campus and change to University Park later.', ['University Park', 'Abington', 'Altoona', 'Behrend (Erie)', 'Berks', 'Brandywine', 'Harrisburg', 'Other campus'], true),
      yn('twoPlusTwo', "Are you open to Penn State's 2+2 plan, beginning at another campus and finishing at University Park?", false),
    ],
    essays: [
      area('psuPersonalStatement', 'Penn State personal statement: Please tell us something about yourself, your experiences, or activities that you believe would reflect positively on your ability to succeed at Penn State. This is your opportunity to tell us something about yourself that is not already reflected in your application.', 3500, true),
    ],
  }),
  'Brigham Young University': ownPortalForm('Brigham Young University', 'enrollment.byu.edu', {
    extraGeneral: [
      {
        key: 'honorCode',
        label:
          'All BYU students, regardless of religious affiliation, commit to live the Church Educational System Honor Code, which includes standards of academic honesty, dress and grooming, and abstention from alcohol, tobacco, coffee, tea and drug use. I have read the Honor Code and commit to live by it.',
        type: 'radio',
        required: true,
        optionsLiteral: true,
        options: ['I commit', 'I need more information'],
      },
      {
        key: 'ecclesiasticalEndorsement',
        label:
          'BYU requires an ecclesiastical endorsement submitted separately by your bishop or, for applicants who are not members of the Church of Jesus Christ of Latter-day Saints, by a local religious leader and the BYU Chaplain. Have you begun this process?',
        type: 'select',
        required: true,
        optionsLiteral: true,
        options: ['Yes, requested', 'Not yet', 'Completed'],
      },
      txt('seminary', 'If you attended seminary or institute, list where and for how long.', false),
    ],
    essays: [
      area('byuEssay1', 'BYU essay: Describe your commitment to the gospel of Jesus Christ and how that commitment shapes your daily life.', 3000, true),
      area('byuEssay2', 'BYU essay: Tell us about a time you overcame a significant challenge, and what it taught you.', 3000, true),
      area('byuEssay3', 'BYU essay: What contribution do you intend to make to the BYU community?', 3000, false),
    ],
  }),
  'University of Washington': ownPortalForm('the University of Washington', 'admit.washington.edu', {
    testing: 'optional',
    extraGeneral: [
      yn('washingtonResident', 'Are you a Washington state resident for tuition purposes?', false),
      ynSelect('directToMajor', 'Some UW majors - Computer Science, Engineering, Business - admit students directly from high school through a separate, far more competitive review. Do you wish to be considered for Direct to College or Direct to Major admission?', false),
    ],
    essays: [
      area('uwEssay', 'UW essay: Tell a story from your life, describing an experience that either demonstrates your character or helped to shape it.', 650, true),
      area('uwShortResponse', 'UW short response: Our families and communities often define us and our individual worlds. Community might refer to your cultural group, extended family, religious group, neighborhood or school, sports team or club, co-workers, and so on. Describe the world you come from and how you, as a product of it, might add to the diversity of the UW.', 300, true),
      area('uwAdditionalInfo', 'Additional information about yourself or your circumstances (optional). You are not required to write anything here.', 200, false),
    ],
    note: `Modelled on the University of Washington's own application for ${CYCLE}. UW does not use the Common Application: it runs its own application with two required writing sections and no letters of recommendation. Reconfirm on admit.washington.edu before you submit.`,
  }),
  'CUNY City College': ownPortalForm('The City College of New York', 'cuny.edu/admissions', {
    testing: 'optional',
    extraGeneral: [
      txt('cunyCampusChoices', 'One CUNY application covers up to six CUNY colleges, ranked in order of preference. List your choices, with City College where you want it.', true),
      yn('nycResident', 'Are you a New York City resident for tuition purposes?', false),
      ynSelect('seekProgram', 'Do you wish to be considered for the SEEK program, which provides financial and academic support to New York City residents who meet its income guidelines?', false),
    ],
    extraAcademics: [
      ynSelect('macaulay', 'Do you wish to be considered for the Macaulay Honors College at City College? Macaulay requires a separate supplemental application and essays.', false),
      ynSelect('groveEngineering', 'Are you applying to the Grove School of Engineering?', false),
    ],
    note: `Modelled on the CUNY application for ${CYCLE}. CUNY does not use the Common Application: one CUNY application covers up to six colleges, ranked in order of preference. Reconfirm on cuny.edu before you submit.`,
  }),
  'Arizona State University': ownPortalForm('Arizona State University', 'admission.asu.edu', {
    testing: 'optional',
    colleges: ['Ira A. Fulton Schools of Engineering', 'W. P. Carey School of Business', 'The College of Liberal Arts and Sciences', 'Walter Cronkite School of Journalism', 'College of Health Solutions', 'Herberger Institute for Design and the Arts', 'Barrett, The Honors College', 'Exploratory'],
    extraGeneral: [
      sel('asuCampus', 'Which ASU campus do you prefer?', ['Tempe', 'Downtown Phoenix', 'Polytechnic', 'West Valley', 'ASU Online'], false),
      yn('arizonaResident', 'Are you an Arizona resident for tuition purposes?', false),
      txt('gpaAndRank', 'Unweighted GPA and class rank, as your school reports them', true, 'ASU publishes assured-admission criteria based on GPA, class rank and test scores, so these determine much of the decision.'),
    ],
    extraAcademics: [
      ynSelect('barrettHonors', 'Do you wish to be considered for Barrett, The Honors College? Barrett requires a separate essay and, for some applicants, an interview.', false),
    ],
  }),
  'University of Arizona': ownPortalForm('the University of Arizona', 'admissions.arizona.edu', {
    testing: 'optional',
    colleges: ['College of Engineering', 'Eller College of Management', 'College of Science', 'College of Social and Behavioral Sciences', 'College of Medicine - Tucson', 'College of Fine Arts', 'W.A. Franke Honors College', 'Undeclared'],
    extraGeneral: [
      yn('arizonaResident', 'Are you an Arizona resident for tuition purposes?', false),
      txt('gpaAndRank', 'Core GPA and class rank as your school reports them', true, 'Arizona publishes assured-admission criteria based on core coursework GPA and class rank.'),
    ],
    extraAcademics: [
      ynSelect('frankeHonors', 'Do you wish to be considered for the W.A. Franke Honors College? It requires a separate application.', false),
    ],
  }),
  'University of Florida': ownPortalForm('the University of Florida', 'admissions.ufl.edu', {
    testing: 'optional',
    colleges: ['Herbert Wertheim College of Engineering', 'Warrington College of Business', 'College of Liberal Arts and Sciences', 'College of Agricultural and Life Sciences', 'College of Journalism and Communications', 'College of the Arts', 'College of Health and Human Performance', 'Exploratory'],
    extraGeneral: [
      yn('floridaResident', 'Are you a Florida resident for tuition purposes?', false),
      ynSelect('brightFutures', "Do you intend to use Florida Bright Futures scholarship funding?", false),
      yn('ufOnline', 'Would you accept an offer to UF Online or the PaCE (Pathway to Campus Enrollment) program if you are not admitted to the residential campus?', false),
    ],
    essays: [
      area('ufEssay', 'UF essay: Please provide additional information about yourself, your interests or your circumstances that you would like the admissions committee to consider.', 2500, true),
      area('ufActivitiesDetail', 'Describe in more detail one activity, work experience or family responsibility that has been most meaningful to you.', 1500, false),
    ],
  }),
  'Florida State University': ownPortalForm('Florida State University', 'admissions.fsu.edu', {
    testing: 'optional',
    extraGeneral: [
      yn('floridaResident', 'Are you a Florida resident for tuition purposes?', false),
      ynSelect('summerStart', 'Would you accept an offer beginning in the Summer term rather than the Fall? FSU admits a substantial share of its class this way.', false),
      ynSelect('care', 'Do you wish to be considered for the CARE program, which supports first-generation students who meet its eligibility criteria?', false),
    ],
    note: `Modelled on Florida State University's application requirements for ${CYCLE}. FSU accepts both its own application and the Common Application. Not captured from the live form - reconfirm on admissions.fsu.edu before you submit.`,
  }),
  'University of Central Florida': ownPortalForm('the University of Central Florida', 'admissions.ucf.edu', {
    testing: 'optional',
    extraGeneral: [
      yn('floridaResident', 'Are you a Florida resident for tuition purposes?', false),
      ynSelect('summerStart', 'Would you accept an offer beginning in the Summer term rather than the Fall?', false),
    ],
    extraAcademics: [
      ynSelect('burnettHonors', 'Do you wish to be considered for The Burnett Honors College?', false),
    ],
  }),
  'University of South Florida': ownPortalForm('the University of South Florida', 'usf.edu/admissions', {
    testing: 'optional',
    extraGeneral: [
      yn('floridaResident', 'Are you a Florida resident for tuition purposes?', false),
      sel('usfCampus', 'Which USF campus do you prefer?', ['Tampa', 'St. Petersburg', 'Sarasota-Manatee'], false),
    ],
    extraAcademics: [
      ynSelect('judyGenshaftHonors', 'Do you wish to be considered for the Judy Genshaft Honors College?', false),
    ],
  }),
  'Florida International University': ownPortalForm('Florida International University', 'admissions.fiu.edu', {
    testing: 'optional',
    extraGeneral: [
      yn('floridaResident', 'Are you a Florida resident for tuition purposes?', false),
      ynSelect('connect4Success', 'Would you accept an offer through Connect4Success, which begins at a partner state college and transfers into FIU?', false),
    ],
    extraAcademics: [
      ynSelect('honorsCollege', 'Do you wish to be considered for the FIU Honors College?', false),
    ],
  }),

  'California State University, Fullerton': calStateForm('California State University, Fullerton', ['Fullerton']),
  'California State University, Long Beach': calStateForm('California State University, Long Beach', ['Long Beach']),
  'San Diego State University': calStateForm('San Diego State University', ['San Diego']),

  'Touro University': ownPortalForm('Touro University', 'touro.edu/admissions', {
    testing: 'optional',
    colleges: ['Lander College of Arts and Sciences', 'Lander College for Men', 'Lander College for Women', 'New York School of Career and Applied Studies', 'School of Health Sciences'],
    extraGeneral: [
      txt('religiousStudies', 'If you are applying to a division with a Judaic studies component, describe your prior yeshiva or seminary study.', false),
    ],
  }),

  /* ---- Common Application member schools ---- */

  'Berea College': commonAppForm('Berea College', {
    plans: PLANS.ea,
    learnedAbout: true,
    extraGeneral: [
      {
        key: 'bereaNoTuition',
        label:
          'Berea charges no tuition and admits only students who demonstrate significant financial need - a family able to pay for college is not eligible. Every student also works 10 or more hours a week in the Labor Program. I understand both conditions.',
        type: 'radio',
        required: true,
        optionsLiteral: true,
        options: ['I understand'],
      },
      txt('bereaHousehold', 'Approximate annual household income and number of people it supports', true, 'Berea determines eligibility from financial need, so this is part of the admission decision, not just aid.'),
      yn('bereaAppalachia', 'Are you from the Appalachian region? Berea gives priority to Appalachian applicants.', false),
      txt('bereaLaborInterest', 'Which campus labor positions interest you?', false),
    ],
  }),
  'Binghamton University': commonAppForm('Binghamton University', {
    plans: PLANS.ed2,
    college: ['Harpur College of Arts and Sciences', 'Thomas J. Watson College of Engineering and Applied Science', 'School of Management', 'Decker College of Nursing and Health Sciences', 'College of Community and Public Affairs'],
    housing: true,
    note: `Modelled on Binghamton University's published member questions for ${CYCLE}. Binghamton accepts both the Common Application and the SUNY application - the SUNY application covers multiple SUNY campuses in one submission. Reconfirm before you submit.`,
  }),
  'Brandeis University': commonAppForm('Brandeis University', { plans: PLANS.ed2, learnedAbout: true, extraAcademics: [
    ynSelect('brandeisScienceProgram', 'Do you wish to be considered for the Science Posse or another Brandeis science scholars program?', false),
  ] }),
  'California Institute of Technology': commonAppForm('the California Institute of Technology', {
    plans: PLANS.ea,
    testing: 'required',
    extraGeneral: [
      txt('caltechMathScience', 'Caltech reinstated a standardized testing requirement after a test-free period, and expects completion of calculus, physics and chemistry. List your math and science coursework through this year.', true),
      ynSelect('caltechResearch', 'Do you wish to submit an optional research or maker portfolio?', false),
    ],
    noLegacy: true,
    note: `Modelled on Caltech's published application requirements for ${CYCLE}. Caltech does not consider legacy and has reinstated a testing requirement. Reconfirm on admissions.caltech.edu before you submit.`,
  }),
  'Case Western Reserve University': commonAppForm('Case Western Reserve University', { plans: PLANS.ed2Ea, housing: true, learnedAbout: true, college: ['Case School of Engineering', 'College of Arts and Sciences', 'Weatherhead School of Management', 'Frances Payne Bolton School of Nursing'], extraAcademics: [
    ynSelect('cwruPreProfessional', 'Do you wish to be considered for the Pre-Professional Scholars Program in Medicine, Dental Medicine, Law or Social Work? It requires a separate essay and interview.', false),
  ] }),
  'Chapman University': commonAppForm('Chapman University', { plans: PLANS.ed2Ea, portfolio: 'Are you applying to Dodge College of Film and Media Arts, the College of Performing Arts or Wilkinson College? These require a supplemental portfolio, audition or writing sample through SlideRoom.', learnedAbout: true, housing: true }),
  'Clark University': commonAppForm('Clark University', { plans: PLANS.ed2Ea, testing: 'blind', learnedAbout: true, extraAcademics: [
    ynSelect('clarkAccelerated', "Do you wish to be considered for Clark's accelerated fifth-year master's degree programs?", false),
  ] }),
  'Clarkson University': commonAppForm('Clarkson University', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, learnedAbout: true, college: ['Wallace H. Coulter School of Engineering', 'School of Arts and Sciences', 'David D. Reh School of Business'] }),
  'Clemson University': commonAppForm('Clemson University', { plans: PLANS.ea, housing: true, college: ['College of Engineering, Computing and Applied Sciences', 'Wilbur O. and Ann Powers College of Business', 'College of Science', 'College of Agriculture, Forestry and Life Sciences', 'College of Architecture, Arts and Humanities', 'College of Behavioral, Social and Health Sciences', 'College of Education'], extraGeneral: [
    yn('southCarolinaResident', 'Are you a South Carolina resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('calhounHonors', 'Do you wish to be considered for the Calhoun Honors College?', false),
    ynSelect('bridgeToClemson', 'Would you accept an offer through Bridge to Clemson, which begins at Tri-County Technical College and transfers in?', false),
  ] }),
  'College of William & Mary': commonAppForm('William & Mary', { plans: PLANS.ed2Ea, extraGeneral: [
    yn('virginiaResident', 'Are you a Virginia resident for tuition purposes? William & Mary is required to reserve a majority of seats for Virginians, so this substantially changes your odds.', false),
  ], extraAcademics: [
    ynSelect('joinDeptOfMonroe', 'Do you wish to be considered for the 1693 Scholars Program or the Murray Scholars Program?', false),
  ] }),
  'Colorado School of Mines': commonAppForm('Colorado School of Mines', { plans: PLANS.ea, extraGeneral: [
    yn('coloradoResident', 'Are you a Colorado resident for tuition purposes?', false),
    txt('minesMathScience', 'Mines expects four years of mathematics through pre-calculus or beyond. List your math and science coursework through this year.', true),
  ] }),
  'Creighton University': commonAppForm('Creighton University', { plans: PLANS.ea, religion: true, housing: true, learnedAbout: true, extraAcademics: [
    ynSelect('creightonHealthProfessions', 'Do you wish to be considered for a direct-admission health professions pathway in medicine, dentistry, pharmacy, occupational therapy or physical therapy?', false),
  ] }),
  'DePaul University': commonAppForm('DePaul University', { plans: PLANS.ea, testing: 'optional', religion: true, housing: true, college: ['College of Computing and Digital Media', 'Driehaus College of Business', 'College of Liberal Arts and Social Sciences', 'College of Science and Health', 'The Theatre School', 'College of Communication', 'School of Music'], portfolio: 'Are you applying to The Theatre School, the School of Music or a design program? These require an audition or portfolio.' }),
  'Drexel University': commonAppForm('Drexel University', { plans: PLANS.ed2Ea, housing: true, college: ['College of Engineering', 'College of Computing and Informatics', 'LeBow College of Business', 'College of Arts and Sciences', 'Westphal College of Media Arts and Design', 'College of Nursing and Health Professions'], extraAcademics: [
    sel('drexelCoop', "Drexel's co-op program is what most students come for. Which co-op plan do you want?", ['Five-year, three co-ops', 'Four-year, one co-op', 'Four-year, no co-op', 'Undecided'], false),
    ynSelect('drexelHonors', 'Do you wish to be considered for the Pennoni Honors College?', false),
  ] }),
  'Elon University': commonAppForm('Elon University', { plans: PLANS.ed2Ea, housing: true, learnedAbout: true, extraAcademics: [
    ynSelect('elonFellows', 'Do you wish to be considered for an Elon Fellows program (Honors, Business, Communications, Teaching, Leadership, Elon College or Isabella Cannon Global Education)? Fellows applications carry an earlier deadline.', false),
  ] }),
  'Fairfield University': commonAppForm('Fairfield University', { plans: PLANS.ed2Ea, religion: true, housing: true, learnedAbout: true, college: ['College of Arts and Sciences', 'Dolan School of Business', 'School of Engineering and Computing', 'Egan School of Nursing and Health Studies', 'School of Education and Human Development'] }),
  'Fordham University': commonAppForm('Fordham University', { plans: PLANS.ed2Ea, religion: true, housing: true, extraGeneral: [
    sel('fordhamCampus', 'Which Fordham campus do you prefer?', ['Rose Hill (Bronx)', 'Lincoln Center (Manhattan)', 'No preference'], false),
  ], college: ['Fordham College at Rose Hill', 'Fordham College at Lincoln Center', 'Gabelli School of Business'] }),
  'George Mason University': commonAppForm('George Mason University', { plans: PLANS.ea, testing: 'optional', housing: true, extraGeneral: [
    yn('virginiaResident', 'Are you a Virginia resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('masonHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'George Washington University': commonAppForm('the George Washington University', { plans: PLANS.ed2, housing: true, college: ['Columbian College of Arts and Sciences', 'School of Engineering and Applied Science', 'School of Business', 'Elliott School of International Affairs', 'School of Media and Public Affairs', 'Milken Institute School of Public Health'], extraAcademics: [
    ynSelect('gwSpecialProgram', 'Do you wish to be considered for a special program such as the seven-year BA/MD or the Corcoran School portfolio track? These require additional materials.', false),
  ] }),
  'Georgia Institute of Technology': commonAppForm('the Georgia Institute of Technology', { plans: ['Early Action I (Georgia residents)', 'Early Action II (non-residents)', 'Regular Decision'], testing: 'required', extraGeneral: [
    yn('georgiaResident', 'Are you a Georgia resident? Georgia Tech reviews residents and non-residents separately and admits residents at a much higher rate.', true),
    txt('testScores', 'SAT and/or ACT scores with test dates. The University System of Georgia requires scores from Georgia Tech applicants.', true),
  ], college: ['College of Engineering', 'College of Computing', 'Scheller College of Business', 'College of Sciences', 'College of Design', 'Ivan Allen College of Liberal Arts'], noLegacy: true }),
  'Gonzaga University': commonAppForm('Gonzaga University', { plans: PLANS.ed2Ea, religion: true, housing: true, learnedAbout: true, extraAcademics: [
    ynSelect('gonzagaHonors', 'Do you wish to be considered for the Honors Program?', false),
  ] }),
  'Howard University': commonAppForm('Howard University', { plans: PLANS.ea, housing: true, learnedAbout: true, college: ['College of Arts and Sciences', 'College of Engineering and Architecture', 'School of Business', 'Cathy Hughes School of Communications', 'College of Nursing and Allied Health Sciences', 'School of Education', 'College of Fine Arts'], extraAcademics: [
    ynSelect('howardHonors', 'Do you wish to be considered for the Howard University Honors Program?', false),
    ynSelect('howardCombinedDegree', 'Do you wish to be considered for a combined BS/MD, BS/DDS or similar accelerated professional program?', false),
  ] }),
  'Illinois Institute of Technology': commonAppForm('Illinois Institute of Technology', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Armour College of Engineering', 'College of Computing', 'Stuart School of Business', 'College of Architecture', 'Lewis College of Science and Letters'], extraAcademics: [
    ynSelect('iitCoterminal', "Do you wish to be considered for a co-terminal bachelor's/master's program?", false),
  ] }),
  'Indiana University Bloomington': commonAppForm('Indiana University Bloomington', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Luddy School of Informatics, Computing and Engineering', 'Kelley School of Business', 'College of Arts and Sciences', 'Jacobs School of Music', 'Media School', 'School of Public Health', 'O’Neill School of Public and Environmental Affairs'], extraGeneral: [
    yn('indianaResident', 'Are you an Indiana resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('kelleyDirect', 'Do you wish to be considered for direct admission to the Kelley School of Business? Direct admission is far more competitive than standard admission to IU.', false),
    ynSelect('huttonHonors', 'Do you wish to be considered for the Hutton Honors College?', false),
  ] }),
  'Iowa State University': commonAppForm('Iowa State University', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['College of Engineering', 'Ivy College of Business', 'College of Liberal Arts and Sciences', 'College of Agriculture and Life Sciences', 'College of Design', 'College of Human Sciences'], extraGeneral: [
    yn('iowaResident', 'Are you an Iowa resident for tuition purposes?', false),
  ] }),
  'Lehigh University': commonAppForm('Lehigh University', { plans: PLANS.ed2, housing: true, college: ['P.C. Rossin College of Engineering and Applied Science', 'College of Business', 'College of Arts and Sciences', 'College of Health'], extraAcademics: [
    ynSelect('lehighIbe', 'Do you wish to be considered for an integrated program such as Integrated Business and Engineering (IBE), Computer Science and Business (CSB), or the South Mountain College?', false),
  ] }),
  'Loyola Marymount University': commonAppForm('Loyola Marymount University', { plans: PLANS.ed2Ea, religion: true, housing: true, portfolio: 'Are you applying to the School of Film and Television or the College of Communication and Fine Arts? These require a supplemental portfolio or audition.', college: ['Frank R. Seaver College of Science and Engineering', 'College of Business Administration', 'Bellarmine College of Liberal Arts', 'School of Film and Television', 'College of Communication and Fine Arts', 'School of Education'] }),
  'Loyola University Chicago': commonAppForm('Loyola University Chicago', { plans: PLANS.ea, testing: 'optional', religion: true, housing: true, extraAcademics: [
    ynSelect('loyolaHonors', 'Do you wish to be considered for the Loyola Honors Program?', false),
    ynSelect('loyolaNursing', 'Are you applying to the Marcella Niehoff School of Nursing? Nursing has a separate, more competitive review.', false),
  ] }),
  'Marquette University': commonAppForm('Marquette University', { plans: PLANS.ea, religion: true, housing: true, learnedAbout: true, college: ['Opus College of Engineering', 'College of Business Administration', 'Klingler College of Arts and Sciences', 'College of Health Sciences', 'College of Nursing', 'Diederich College of Communication', 'College of Education'], extraAcademics: [
    ynSelect('marquetteDirectPt', 'Do you wish to be considered for a direct-admission program in Physical Therapy, Physician Assistant Studies or Dentistry?', false),
  ] }),
  'Miami University': commonAppForm('Miami University', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, learnedAbout: true, college: ['College of Engineering and Computing', 'Farmer School of Business', 'College of Arts and Science', 'College of Creative Arts', 'College of Education, Health and Society', 'College of Emerging Technology in Business and Design'], extraGeneral: [
    yn('ohioResident', 'Are you an Ohio resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('miamiHonors', 'Do you wish to be considered for the University Honors College?', false),
  ] }),
  'Michigan State University': commonAppForm('Michigan State University', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Eli Broad College of Business', 'College of Natural Science', 'College of Social Science', 'College of Communication Arts and Sciences', 'College of Agriculture and Natural Resources', 'James Madison College', 'Lyman Briggs College'], extraGeneral: [
    yn('michiganResident', 'Are you a Michigan resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('msuHonors', 'Do you wish to be considered for the Honors College?', false),
  ], note: `Modelled on Michigan State University's published member questions for ${CYCLE}. MSU accepts both the Common Application and its own application. Reconfirm before you submit.` }),
  'New Jersey Institute of Technology': commonAppForm('New Jersey Institute of Technology', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Newark College of Engineering', 'Ying Wu College of Computing', 'College of Science and Liberal Arts', 'Hillier College of Architecture and Design', 'Martin Tuchman School of Management'], extraGeneral: [
    yn('newJerseyResident', 'Are you a New Jersey resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('njitAlbertDorman', 'Do you wish to be considered for the Albert Dorman Honors College?', false),
    ynSelect('njitAccelerated', 'Do you wish to be considered for an accelerated BS/MD, BS/DMD or BS/OD program with a partner medical school?', false),
  ] }),
  'North Carolina State University': commonAppForm('North Carolina State University', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Poole College of Management', 'College of Sciences', 'College of Agriculture and Life Sciences', 'College of Design', 'College of Humanities and Social Sciences', 'College of Natural Resources', 'College of Education'], extraGeneral: [
    yn('northCarolinaResident', 'Are you a North Carolina resident for tuition purposes? The UNC System caps out-of-state enrolment, so this substantially changes your odds.', false),
  ], extraAcademics: [
    ynSelect('ncsuParkScholarship', 'Do you wish to be considered for the Park Scholarships? They require a separate application with an earlier deadline.', false),
  ] }),
  'Northwestern University': commonAppForm('Northwestern University', { plans: PLANS.edEa.slice(0, 1).concat(['Regular Decision']), housing: true, college: ['McCormick School of Engineering and Applied Science', 'Weinberg College of Arts and Sciences', 'Medill School of Journalism', 'School of Communication', 'Bienen School of Music', 'School of Education and Social Policy'], portfolio: 'Are you applying to the Bienen School of Music or a performance program in the School of Communication? These require an audition or portfolio submitted separately.', extraAcademics: [
    ynSelect('northwesternCombined', 'Do you wish to be considered for a combined-degree program such as HPME, ISP, MMSS or the Integrated Engineering Studies program?', false),
  ] }),
  'Ohio State University': commonAppForm('the Ohio State University', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Fisher College of Business', 'College of Arts and Sciences', 'College of Food, Agricultural and Environmental Sciences', 'College of Nursing', 'College of Public Health', 'College of Education and Human Ecology'], extraGeneral: [
    yn('ohioResident', 'Are you an Ohio resident for tuition purposes?', false),
    sel('campusPreference', 'Ohio State admits to Columbus and to regional campuses. Would you accept an offer at a regional campus with a pathway to Columbus?', ['Columbus only', 'Columbus, or a regional campus if not admitted', 'Regional campus preferred'], false),
  ], extraAcademics: [
    ynSelect('osuHonors', 'Do you wish to be considered for the Honors or Scholars programs?', false),
  ] }),
  'Oregon State University': commonAppForm('Oregon State University', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['College of Engineering', 'College of Business', 'College of Science', 'College of Agricultural Sciences', 'College of Forestry', 'College of Earth, Ocean and Atmospheric Sciences', 'College of Liberal Arts'], extraGeneral: [
    yn('oregonResident', 'Are you an Oregon resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('osuHonorsCollege', 'Do you wish to be considered for the Honors College? It requires a separate essay.', false),
  ] }),
  'Pepperdine University': commonAppForm('Pepperdine University', { plans: PLANS.ea, religion: true, housing: true, learnedAbout: true, extraGeneral: [
    yn('pepperdineFaithStatement', 'Pepperdine is affiliated with the Churches of Christ and requires students to attend Convocation. Are you willing to participate in the religious life of the university?', false),
  ], extraAcademics: [
    ynSelect('pepperdineInternational', "Nearly all Pepperdine undergraduates study abroad. Do you wish to be considered for a first-year international program?", false),
  ] }),
  'Purdue University': commonAppForm('Purdue University', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Daniels School of Business', 'College of Science', 'Polytechnic Institute', 'College of Agriculture', 'College of Health and Human Sciences', 'College of Liberal Arts', 'Exploratory Studies'], extraGeneral: [
    yn('indianaResident', 'Are you an Indiana resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('purdueHonors', 'Do you wish to be considered for the Honors College?', false),
    txt('alternateCollege', 'Purdue admits by major, and engineering and computer science are far more competitive than the university overall. Name an alternate college you would accept.', false),
  ] }),
  'Rensselaer Polytechnic Institute': commonAppForm('Rensselaer Polytechnic Institute', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['School of Engineering', 'School of Science', 'Lally School of Management', 'School of Architecture', 'School of Humanities, Arts and Social Sciences', 'School of Computer and Cognitive Science'], extraAcademics: [
    ynSelect('rpiAccelerated', 'Do you wish to be considered for an accelerated program such as the Physician-Scientist (BS/MD) or Accelerated Law program? These require separate materials.', false),
  ] }),
  'Rochester Institute of Technology': commonAppForm('Rochester Institute of Technology', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, portfolio: 'Are you applying to the College of Art and Design, the School of Film and Animation, or a photography program? These require a portfolio submitted through SlideRoom.', college: ['Kate Gleason College of Engineering', 'Golisano College of Computing and Information Sciences', 'Saunders College of Business', 'College of Art and Design', 'College of Science', 'College of Engineering Technology', 'National Technical Institute for the Deaf'], extraAcademics: [
    ynSelect('ritCoop', "RIT's co-op is required in most majors. Do you have questions about co-op placement you would like an advisor to follow up on?", false),
  ] }),
  'Saint Louis University': commonAppForm('Saint Louis University', { plans: PLANS.rolling, religion: true, housing: true, learnedAbout: true, extraAcademics: [
    ynSelect('sluMedicalScholars', 'Do you wish to be considered for the Medical Scholars, Physical Therapy or other direct-entry health professions programs? These require a separate application.', false),
  ] }),
  'Santa Clara University': commonAppForm('Santa Clara University', { plans: PLANS.ed2Ea, religion: true, housing: true, college: ['School of Engineering', 'Leavey School of Business', 'College of Arts and Sciences'], extraAcademics: [
    ynSelect('scuHonors', 'Do you wish to be considered for the University Honors Program or the LEAD Scholars Program for first-generation students?', false),
  ] }),
  'Southern Methodist University': commonAppForm('Southern Methodist University', { plans: PLANS.ed2Ea, housing: true, learnedAbout: true, portfolio: 'Are you applying to the Meadows School of the Arts? Most Meadows majors require an audition or portfolio.', college: ['Lyle School of Engineering', 'Cox School of Business', 'Dedman College of Humanities and Sciences', 'Meadows School of the Arts', 'Simmons School of Education and Human Development'], extraAcademics: [
    ynSelect('smuHuntScholars', 'Do you wish to be considered for the Hunt Leadership Scholars, President’s Scholars or another named scholarship? These require separate applications.', false),
  ] }),
  'Stevens Institute of Technology': commonAppForm('Stevens Institute of Technology', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['Schaefer School of Engineering and Science', 'School of Business', 'School of Systems and Enterprises', 'College of Arts and Letters'], extraAcademics: [
    ynSelect('stevensAccelerated', 'Do you wish to be considered for an accelerated program such as the Accelerated Pre-Medical/Pre-Dental Program or a four-plus-one degree?', false),
  ] }),
  'Stony Brook University': commonAppForm('Stony Brook University', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['College of Engineering and Applied Sciences', 'College of Arts and Sciences', 'College of Business', 'School of Nursing', 'School of Health Professions', 'School of Marine and Atmospheric Sciences'], extraAcademics: [
    ynSelect('stonyBrookHonors', 'Do you wish to be considered for the Honors College, WISE, University Scholars or the Scholars for Medicine program?', false),
  ], note: `Modelled on Stony Brook University's published member questions for ${CYCLE}. Stony Brook accepts both the Common Application and the SUNY application. Reconfirm before you submit.` }),
  'Syracuse University': commonAppForm('Syracuse University', { plans: PLANS.ed2, housing: true, portfolio: 'Are you applying to the College of Visual and Performing Arts or the School of Architecture? These require a portfolio or audition.', college: ['College of Engineering and Computer Science', 'Whitman School of Management', 'College of Arts and Sciences', 'Newhouse School of Public Communications', 'Maxwell School of Citizenship and Public Affairs', 'College of Visual and Performing Arts', 'School of Architecture', 'Falk College of Sport and Human Dynamics'] }),
  'Temple University': commonAppForm('Temple University', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Fox School of Business', 'College of Science and Technology', 'College of Liberal Arts', 'Klein College of Media and Communication', 'Boyer College of Music and Dance', 'Tyler School of Art and Architecture', 'College of Public Health'], extraGeneral: [
    yn('pennsylvaniaResident', 'Are you a Pennsylvania resident for tuition purposes?', false),
    ynSelect('templeOption', "Temple's self-reported academic record option lets some applicants substitute an essay and short answers for test scores. Do you wish to apply through the Temple Option?", false),
  ] }),
  'Texas Christian University': commonAppForm('Texas Christian University', { plans: PLANS.ed2Ea, religion: true, housing: true, learnedAbout: true, college: ['College of Science and Engineering', 'Neeley School of Business', 'AddRan College of Liberal Arts', 'Bob Schieffer College of Communication', 'College of Fine Arts', 'Harris College of Nursing and Health Sciences', 'College of Education'], extraAcademics: [
    ynSelect('tcuHonors', 'Do you wish to be considered for the John V. Roach Honors College?', false),
  ] }),
  'Thomas Jefferson University': commonAppForm('Thomas Jefferson University', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, portfolio: 'Are you applying to a design, fashion or architecture program? These require a portfolio.', college: ['College of Architecture and the Built Environment', 'Kanbar College of Design, Engineering and Commerce', 'College of Health Professions', 'College of Life Sciences', 'College of Humanities and Sciences'], extraAcademics: [
    ynSelect('jeffersonAccelerated', 'Do you wish to be considered for an accelerated health professions program leading to the Sidney Kimmel Medical College or another Jefferson graduate program?', false),
  ] }),
  'University at Albany': commonAppForm('the University at Albany', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering and Applied Sciences', 'College of Arts and Sciences', 'Massry School of Business', 'Rockefeller College of Public Affairs and Policy', 'College of Emergency Preparedness, Homeland Security and Cybersecurity', 'School of Education'], note: `Modelled on the University at Albany's published member questions for ${CYCLE}. Albany accepts both the Common Application and the SUNY application. Reconfirm before you submit.` }),
  'University at Buffalo': commonAppForm('the University at Buffalo', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['School of Engineering and Applied Sciences', 'School of Management', 'College of Arts and Sciences', 'School of Nursing', 'School of Public Health and Health Professions', 'School of Architecture and Planning'], extraAcademics: [
    ynSelect('ubHonors', 'Do you wish to be considered for the UB Honors College? It requires a separate essay.', false),
  ], note: `Modelled on the University at Buffalo's published member questions for ${CYCLE}. Buffalo accepts both the Common Application and the SUNY application. Reconfirm before you submit.` }),
  'University of Alabama at Birmingham': commonAppForm('the University of Alabama at Birmingham', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['School of Engineering', 'Collat School of Business', 'College of Arts and Sciences', 'School of Nursing', 'School of Health Professions', 'School of Education and Human Sciences'], extraAcademics: [
    ynSelect('uabHonors', 'Do you wish to be considered for the UAB Honors College? It requires a separate application.', false),
    ynSelect('uabEarlyMedical', 'Do you wish to be considered for the Early Medical School Acceptance Program (EMSAP) or a similar early-assurance health pathway?', false),
  ] }),
  'University of Colorado Boulder': commonAppForm('the University of Colorado Boulder', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering and Applied Science', 'Leeds School of Business', 'College of Arts and Sciences', 'College of Media, Communication and Information', 'Program in Environmental Design', 'College of Music'], extraGeneral: [
    yn('coloradoResident', 'Are you a Colorado resident for tuition purposes?', false),
  ] }),
  'University of Connecticut': commonAppForm('the University of Connecticut', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'School of Business', 'College of Liberal Arts and Sciences', 'School of Nursing', 'College of Agriculture, Health and Natural Resources', 'School of Fine Arts', 'Neag School of Education'], extraGeneral: [
    yn('connecticutResident', 'Are you a Connecticut resident for tuition purposes?', false),
    sel('uconnCampus', 'UConn admits to Storrs and to regional campuses. Would you accept an offer at a regional campus?', ['Storrs only', 'Storrs, or a regional campus if not admitted', 'Regional campus preferred'], false),
  ], extraAcademics: [
    ynSelect('uconnHonors', 'Do you wish to be considered for the Honors Program? It requires a separate essay.', false),
    ynSelect('uconnSpecialProgram', 'Do you wish to be considered for a special program such as the Special Program in Medicine or Dental Medicine, or the Eurotech/Engineering House programs?', false),
  ] }),
  'University of Dayton': commonAppForm('the University of Dayton', { plans: PLANS.ea, testing: 'optional', religion: true, housing: true, learnedAbout: true, extraAcademics: [
    ynSelect('daytonHonors', 'Do you wish to be considered for the University Honors Program or the Berry Summer Thesis Institute?', false),
  ] }),
  'University of Delaware': commonAppForm('the University of Delaware', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Alfred Lerner College of Business and Economics', 'College of Arts and Sciences', 'College of Health Sciences', 'College of Agriculture and Natural Resources', 'College of Earth, Ocean and Environment', 'College of Education and Human Development'], extraGeneral: [
    yn('delawareResident', 'Are you a Delaware resident for tuition purposes?', false),
    ynSelect('associateInArts', 'Would you accept an offer through the Associate in Arts Program, which begins at a Delaware campus and transfers to Newark?', false),
  ], extraAcademics: [
    ynSelect('udHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'University of Denver': commonAppForm('the University of Denver', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, learnedAbout: true, college: ['Ritchie School of Engineering and Computer Science', 'Daniels College of Business', 'College of Arts, Humanities and Social Sciences', 'Division of Natural Sciences and Mathematics', 'Lamont School of Music', 'Josef Korbel School of International Studies'], extraAcademics: [
    ynSelect('duPioneerLeaders', 'Do you wish to be considered for a scholarship or scholars community such as the Chancellor Scholarship or the Pioneer Leadership Program? These require separate essays.', false),
  ] }),
  'University of Georgia': commonAppForm('the University of Georgia', { plans: PLANS.ea, testing: 'required', extraGeneral: [
    yn('georgiaResident', 'Are you a Georgia resident? UGA reviews residents and non-residents separately.', true),
    txt('testScores', 'SAT and/or ACT scores with test dates. The University System of Georgia requires scores from UGA applicants.', true),
    ynSelect('zellMiller', 'Do you intend to use HOPE or Zell Miller scholarship funding?', false),
  ], college: ['Franklin College of Arts and Sciences', 'Terry College of Business', 'College of Engineering', 'Grady College of Journalism and Mass Communication', 'College of Agricultural and Environmental Sciences', 'College of Family and Consumer Sciences', 'Mary Frances Early College of Education'], extraAcademics: [
    ynSelect('ugaHonors', 'Do you wish to be considered for the Morehead Honors College?', false),
  ] }),
  'University of Illinois Chicago': commonAppForm('the University of Illinois Chicago', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'College of Business Administration', 'College of Liberal Arts and Sciences', 'College of Nursing', 'College of Applied Health Sciences', 'College of Architecture, Design and the Arts', 'School of Public Health'], extraGeneral: [
    yn('illinoisResident', 'Are you an Illinois resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('uicHonors', 'Do you wish to be considered for the Honors College?', false),
    ynSelect('uicGppa', 'Do you wish to be considered for the Guaranteed Professional Program Admissions (GPPA) pathway in medicine, dentistry, pharmacy or another health field? GPPA requires separate essays and is highly competitive.', false),
  ] }),
  'University of Illinois Urbana-Champaign': commonAppForm('the University of Illinois Urbana-Champaign', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Grainger College of Engineering', 'Gies College of Business', 'College of Liberal Arts and Sciences', 'College of Agricultural, Consumer and Environmental Sciences', 'College of Media', 'College of Fine and Applied Arts', 'School of Information Sciences', 'College of Education'], extraGeneral: [
    yn('illinoisResident', 'Are you an Illinois resident for tuition purposes?', false),
  ], extraAcademics: [
    txt('secondChoiceMajorNote', 'Illinois admits by major, and Computer Science and Engineering are admitted at a far lower rate than the university overall. Name a genuine second-choice major in a different college.', true),
  ] }),
  'University of Iowa': commonAppForm('the University of Iowa', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['College of Engineering', 'Tippie College of Business', 'College of Liberal Arts and Sciences', 'College of Nursing', 'College of Public Health', 'College of Education'], extraGeneral: [
    yn('iowaResident', 'Are you an Iowa resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('iowaHonors', 'Do you wish to be considered for the Honors Program?', false),
  ] }),
  'University of Kansas': commonAppForm('the University of Kansas', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['School of Engineering', 'School of Business', 'College of Liberal Arts and Sciences', 'School of Architecture and Design', 'School of Journalism and Mass Communications', 'School of Music', 'School of Education and Human Sciences'], extraGeneral: [
    yn('kansasResident', 'Are you a Kansas resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('kuHonors', 'Do you wish to be considered for the University Honors Program?', false),
  ] }),
  'University of Kentucky': commonAppForm('the University of Kentucky', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['College of Engineering', 'Gatton College of Business and Economics', 'College of Arts and Sciences', 'College of Nursing', 'College of Health Sciences', 'College of Agriculture, Food and Environment', 'College of Education'], extraGeneral: [
    yn('kentuckyResident', 'Are you a Kentucky resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('ukHonors', 'Do you wish to be considered for the Lewis Honors College?', false),
  ] }),
  'University of Maryland Baltimore County': commonAppForm('the University of Maryland, Baltimore County', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering and Information Technology', 'College of Natural and Mathematical Sciences', 'College of Arts, Humanities and Social Sciences'], extraGeneral: [
    yn('marylandResident', 'Are you a Maryland resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('umbcMeyerhoff', 'Do you wish to be considered for the Meyerhoff Scholars Program, Sherman Scholars or the Honors College? These require separate applications.', false),
  ] }),
  'University of Maryland, College Park': commonAppForm('the University of Maryland, College Park', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['A. James Clark School of Engineering', 'Robert H. Smith School of Business', 'College of Computer, Mathematical and Natural Sciences', 'College of Behavioral and Social Sciences', 'Philip Merrill College of Journalism', 'College of Arts and Humanities', 'School of Public Health', 'College of Agriculture and Natural Resources'], extraGeneral: [
    yn('marylandResident', 'Are you a Maryland resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('umdLivingLearning', 'Do you wish to be considered for a living-learning program such as Honors, Scholars, Gemstone or the Banneker/Key Scholarship?', false),
  ] }),
  'University of Massachusetts Amherst': commonAppForm('the University of Massachusetts Amherst', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Isenberg School of Management', 'College of Natural Sciences', 'College of Social and Behavioral Sciences', 'College of Humanities and Fine Arts', 'College of Information and Computer Sciences', 'School of Nursing', 'School of Public Health and Health Sciences'], extraGeneral: [
    yn('massachusettsResident', 'Are you a Massachusetts resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('umassHonors', 'Do you wish to be considered for Commonwealth Honors College?', false),
  ] }),
  'University of Miami': commonAppForm('the University of Miami', { plans: PLANS.ed2Ea, housing: true, portfolio: 'Are you applying to the Frost School of Music or a program in the School of Architecture? These require an audition or portfolio.', college: ['College of Engineering', 'Miami Herbert Business School', 'College of Arts and Sciences', 'Rosenstiel School of Marine, Atmospheric and Earth Science', 'School of Communication', 'Frost School of Music', 'School of Architecture', 'School of Nursing and Health Studies', 'School of Education and Human Development'], extraAcademics: [
    ynSelect('miamiDualDegree', 'Do you wish to be considered for a dual-degree program such as the Honors Program in Medicine (HPME) or the Dual Degree in Law? These require separate materials.', false),
  ] }),
  'University of Michigan': commonAppForm('the University of Michigan', { plans: PLANS.ea, testing: 'optional', housing: true, portfolio: 'Are you applying to the Penny W. Stamps School of Art & Design, the School of Music, Theatre & Dance, or Taubman College of Architecture? These require a portfolio or audition and have separate deadlines.', college: ['College of Engineering', 'Ross School of Business', 'College of Literature, Science, and the Arts', 'School of Nursing', 'School of Kinesiology', 'School of Information', 'Taubman College of Architecture and Urban Planning', 'School of Music, Theatre & Dance', 'Stamps School of Art & Design'], extraGeneral: [
    yn('michiganResident', 'Are you a Michigan resident for tuition purposes? Michigan enrols a majority of in-state students, so this substantially changes your odds.', false),
  ], extraAcademics: [
    ynSelect('michiganLsaHonors', 'Do you wish to be considered for LSA Honors, the Residential College or another living-learning community?', false),
    txt('alternateCollege', 'Michigan admits by school or college, and Ross and Engineering are admitted at a far lower rate than LSA. Name an alternate college you would accept.', false),
  ] }),
  'University of Minnesota Twin Cities': commonAppForm('the University of Minnesota Twin Cities', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Science and Engineering', 'Carlson School of Management', 'College of Liberal Arts', 'College of Biological Sciences', 'College of Food, Agricultural and Natural Resource Sciences', 'College of Design', 'College of Education and Human Development'], extraGeneral: [
    yn('minnesotaResident', 'Are you a Minnesota resident, or eligible for reciprocity with Wisconsin, North Dakota, South Dakota or Manitoba?', false),
  ], extraAcademics: [
    ynSelect('umnHonors', 'Do you wish to be considered for the University Honors Program? It requires a separate essay.', false),
  ], note: `Modelled on the University of Minnesota Twin Cities' published member questions for ${CYCLE}. Minnesota accepts both the Common Application and its own Golden Gopher application. Reconfirm before you submit.` }),
  'University of Missouri': commonAppForm('the University of Missouri', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['College of Engineering', 'Trulaske College of Business', 'College of Arts and Science', 'School of Journalism', 'College of Agriculture, Food and Natural Resources', 'Sinclair School of Nursing', 'College of Health Sciences', 'College of Education and Human Development'], extraGeneral: [
    yn('missouriResident', 'Are you a Missouri resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('mizzouHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'University of New Hampshire': commonAppForm('the University of New Hampshire', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering and Physical Sciences', 'Peter T. Paul College of Business and Economics', 'College of Liberal Arts', 'College of Life Sciences and Agriculture', 'College of Health and Human Services'], extraGeneral: [
    yn('newHampshireResident', 'Are you a New Hampshire resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('unhHonors', 'Do you wish to be considered for the University Honors Program?', false),
  ] }),
  'University of North Carolina at Charlotte': commonAppForm('the University of North Carolina at Charlotte', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['William States Lee College of Engineering', 'Belk College of Business', 'College of Computing and Informatics', 'College of Liberal Arts and Sciences', 'College of Health and Human Services', 'College of Arts + Architecture'], extraGeneral: [
    yn('northCarolinaResident', 'Are you a North Carolina resident for tuition purposes? The UNC System caps out-of-state enrolment.', false),
  ], extraAcademics: [
    ynSelect('charlotteHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'University of Oklahoma': commonAppForm('the University of Oklahoma', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Gallogly College of Engineering', 'Price College of Business', 'College of Arts and Sciences', 'Gaylord College of Journalism and Mass Communication', 'College of Atmospheric and Geographic Sciences', 'Christopher C. Gibbs College of Architecture', 'College of Fine Arts'], extraGeneral: [
    yn('oklahomaResident', 'Are you an Oklahoma resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('ouHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'University of Oregon': commonAppForm('the University of Oregon', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Arts and Sciences', 'Lundquist College of Business', 'School of Journalism and Communication', 'College of Design', 'College of Education', 'Clark Honors College'], extraGeneral: [
    yn('oregonResident', 'Are you an Oregon resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('clarkHonors', 'Do you wish to be considered for the Clark Honors College? It requires separate essays.', false),
  ] }),
  'University of Pittsburgh': commonAppForm('the University of Pittsburgh', { plans: PLANS.rolling, testing: 'optional', housing: true, college: ['Swanson School of Engineering', 'College of Business Administration', 'Dietrich School of Arts and Sciences', 'School of Nursing', 'School of Health and Rehabilitation Sciences', 'School of Computing and Information', 'School of Pharmacy'], extraGeneral: [
    yn('pennsylvaniaResident', 'Are you a Pennsylvania resident for tuition purposes?', false),
    sel('pittCampus', 'Pitt admits to Pittsburgh and to regional campuses. Would you accept an offer at a regional campus?', ['Pittsburgh only', 'Pittsburgh, or a regional campus if not admitted', 'Regional campus preferred'], false),
  ], extraAcademics: [
    ynSelect('pittHonors', 'Do you wish to be considered for the Frederick Honors College or a guaranteed-admission professional program in medicine, dentistry, pharmacy or law? Guaranteed-admission programs require separate essays and are highly competitive.', false),
  ] }),
  'University of Rochester': commonAppForm('the University of Rochester', { plans: PLANS.ed2Ea, housing: true, portfolio: 'Are you applying to the Eastman School of Music? Eastman requires a separate application and audition.', college: ['School of Arts and Sciences', 'Hajim School of Engineering and Applied Sciences', 'School of Nursing', 'Eastman School of Music'], extraAcademics: [
    ynSelect('rochesterRems', 'Do you wish to be considered for the Rochester Early Medical Scholars (REMS) or another guaranteed-admission program? These require separate essays.', false),
  ] }),
  'University of San Diego': commonAppForm('the University of San Diego', { plans: PLANS.ed2Ea, religion: true, housing: true, learnedAbout: true, college: ['Shiley-Marcos School of Engineering', 'Knauss School of Business', 'College of Arts and Sciences', 'Hahn School of Nursing and Health Science', 'School of Leadership and Education Sciences'] }),
  'University of San Francisco': commonAppForm('the University of San Francisco', { plans: PLANS.ed2Ea, testing: 'optional', religion: true, housing: true, learnedAbout: true, college: ['College of Arts and Sciences', 'School of Management', 'School of Nursing and Health Professions', 'School of Education'] }),
  'University of South Carolina': commonAppForm('the University of South Carolina', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering and Computing', 'Darla Moore School of Business', 'College of Arts and Sciences', 'College of Nursing', 'Arnold School of Public Health', 'College of Information and Communications', 'College of Hospitality, Retail and Sport Management'], extraGeneral: [
    yn('southCarolinaResident', 'Are you a South Carolina resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('scHonors', 'Do you wish to be considered for the South Carolina Honors College or the Capstone Scholars Program? The Honors College requires separate essays.', false),
  ] }),
  'University of Tennessee, Knoxville': commonAppForm('the University of Tennessee, Knoxville', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['Tickle College of Engineering', 'Haslam College of Business', 'College of Arts and Sciences', 'College of Nursing', 'Herbert College of Agriculture', 'College of Communication and Information', 'College of Education, Health and Human Sciences'], extraGeneral: [
    yn('tennesseeResident', 'Are you a Tennessee resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('utkHonors', 'Do you wish to be considered for the Haslam Scholars Program or another honors program?', false),
  ] }),
  'University of the Pacific': commonAppForm('the University of the Pacific', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, learnedAbout: true, college: ['School of Engineering and Computer Science', 'Eberhardt School of Business', 'College of the Pacific', 'Conservatory of Music', 'School of Health Sciences', 'Benerd College'], portfolio: 'Are you applying to the Conservatory of Music? It requires an audition.', extraAcademics: [
    ynSelect('pacificAccelerated', 'Do you wish to be considered for an accelerated pre-professional program in Dentistry, Pharmacy or Law? These require separate materials.', false),
  ] }),
  'University of Vermont': commonAppForm('the University of Vermont', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['College of Engineering and Mathematical Sciences', 'Grossman School of Business', 'College of Arts and Sciences', 'Rubenstein School of Environment and Natural Resources', 'College of Nursing and Health Sciences', 'College of Agriculture and Life Sciences', 'College of Education and Social Services'], extraGeneral: [
    yn('vermontResident', 'Are you a Vermont resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('uvmHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'University of Wisconsin-Madison': commonAppForm('the University of Wisconsin-Madison', { plans: PLANS.ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Wisconsin School of Business', 'College of Letters & Science', 'College of Agricultural and Life Sciences', 'School of Nursing', 'School of Education', 'School of Human Ecology', 'School of Pharmacy'], extraGeneral: [
    yn('wisconsinResident', 'Are you a Wisconsin resident, or eligible for Minnesota reciprocity?', false),
  ], extraAcademics: [
    txt('secondChoiceMajorNote', 'Wisconsin asks for a second-choice major. Computer Sciences, Business and Engineering are admitted at a lower rate than the university overall, so make the second choice genuine.', false),
  ], note: `Modelled on the University of Wisconsin-Madison's published member questions for ${CYCLE}. UW-Madison accepts both the Common Application and the UW System application. Reconfirm before you submit.` }),
  'Virginia Commonwealth University': commonAppForm('Virginia Commonwealth University', { plans: PLANS.ea, testing: 'optional', housing: true, portfolio: 'Are you applying to the School of the Arts? VCUarts requires a portfolio submitted through SlideRoom, and its own deadline is earlier than the university’s.', college: ['College of Engineering', 'School of Business', 'College of Humanities and Sciences', 'School of the Arts', 'School of Nursing', 'College of Health Professions', 'L. Douglas Wilder School of Government and Public Affairs'], extraGeneral: [
    yn('virginiaResident', 'Are you a Virginia resident for tuition purposes?', false),
  ], extraAcademics: [
    ynSelect('vcuHonors', 'Do you wish to be considered for the Honors College or the Guaranteed Admission Program in medicine, dentistry or pharmacy?', false),
  ] }),
  'Virginia Tech': commonAppForm('Virginia Tech', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['College of Engineering', 'Pamplin College of Business', 'College of Science', 'College of Agriculture and Life Sciences', 'College of Architecture, Arts, and Design', 'College of Liberal Arts and Human Sciences', 'College of Natural Resources and Environment'], extraGeneral: [
    yn('virginiaResident', 'Are you a Virginia resident for tuition purposes?', false),
    ynSelect('corpsOfCadets', 'Do you wish to join the Virginia Tech Corps of Cadets?', false),
  ], extraAcademics: [
    ynSelect('vtHonors', 'Do you wish to be considered for the Honors College?', false),
  ] }),
  'Worcester Polytechnic Institute': commonAppForm('Worcester Polytechnic Institute', { plans: PLANS.ed2Ea, testing: 'blind', housing: true, extraAcademics: [
    ynSelect('wpiProjectBased', "WPI's curriculum is project-based, with required projects in the humanities and in your major, many of them completed at a project centre abroad. Would you like more information about project centres?", false),
  ] }),
  'Yeshiva University': commonAppForm('Yeshiva University', { plans: PLANS.rolling, testing: 'optional', religion: true, housing: true, college: ['Yeshiva College (men)', 'Stern College for Women', 'Sy Syms School of Business', 'Katz School of Science and Health'], extraGeneral: [
    sel('yeshivaTorahStudies', 'Yeshiva pairs a full college curriculum with a morning Torah studies programme. Which programme are you applying to?', ['Mazer Yeshiva Program (MYP)', 'Isaac Breuer College (IBC)', 'James Striar School (JSS)', 'Stern College Judaic Studies', 'Undecided'], true),
    txt('yeshivaPriorStudy', 'Describe your prior yeshiva, seminary or day-school study, including any year in Israel.', false),
  ] }),

  /* ---- Liberal arts colleges ---- */

  'Bryn Mawr College': commonAppForm('Bryn Mawr College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraGeneral: [
    yn('brynMawrConsortium', 'Bryn Mawr students cross-register at Haverford, Swarthmore and Penn through the Tri-Co and Quaker Consortium. Would you like information about consortium study?', false),
  ] }),
  'Bucknell University': commonAppForm('Bucknell University', { plans: PLANS.ed2, housing: true, college: ['College of Arts and Sciences', 'College of Engineering', 'Freeman College of Management'], extraAcademics: [
    ynSelect('bucknellResidentialCollege', 'Do you wish to be considered for a residential college or the Bucknell Arts Merit Scholarship?', false),
  ] }),
  'Colorado College': commonAppForm('Colorado College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraGeneral: [
    yn('blockPlan', 'Colorado College runs on the Block Plan: one course at a time, in three-and-a-half-week blocks. I understand this is how every course is taught here.', false),
  ] }),
  'Davidson College': commonAppForm('Davidson College', { plans: PLANS.ed2, extraAcademics: [
    ynSelect('davidsonScholars', 'Do you wish to be considered for a named scholarship such as the Belk, Bryan or Davidson Impact Fellows? These require separate nomination or application.', false),
  ] }),
  'Denison University': commonAppForm('Denison University', { plans: PLANS.ed2Ea, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('denisonScholarship', 'Do you wish to be considered for a merit scholarship such as the Wells, Faculty or Fine Arts awards? Some require an audition or portfolio.', false),
  ] }),
  'Gettysburg College': commonAppForm('Gettysburg College', { plans: PLANS.ed2Ea, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('gettysburgSpecialProgram', 'Do you wish to be considered for a special program such as the Eisenhower Institute Undergraduate Fellows, the Garthwait Leadership Center or a music scholarship?', false),
  ] }),
  'Grinnell College': commonAppForm('Grinnell College', { plans: PLANS.ed2, testing: 'optional', extraAcademics: [
    ynSelect('grinnellIndividualAdvising', 'Grinnell has no core curriculum: every student designs their course of study with a faculty adviser. Would you like information about the individually advised curriculum?', false),
  ] }),
  'Kenyon College': commonAppForm('Kenyon College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('kenyonScienceScholars', 'Do you wish to be considered for the Kenyon Science Scholars, the Kenyon Educational Enrichment Program or a departmental scholarship?', false),
  ] }),
  'Lafayette College': commonAppForm('Lafayette College', { plans: PLANS.ed2, testing: 'optional', college: ['College of Arts and Sciences', 'College of Engineering'], extraAcademics: [
    ynSelect('lafayetteMarquis', 'Do you wish to be considered for the Marquis Scholarship or the Marquis Fellowship? These require additional essays.', false),
  ] }),
  'Macalester College': commonAppForm('Macalester College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('macalesterScholarship', 'Do you wish to be considered for a named scholarship such as the DeWitt Wallace Distinguished Scholarship or a Kofi Annan International Scholarship?', false),
  ] }),
  'Oberlin College': commonAppForm('Oberlin College', { plans: PLANS.ed2, testing: 'optional', portfolio: 'Are you applying to the Oberlin Conservatory of Music or the Double Degree program? The Conservatory requires a separate audition and prescreening.', college: ['College of Arts and Sciences', 'Conservatory of Music', 'Double Degree (both)'] }),
  'Occidental College': commonAppForm('Occidental College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('oxyScholars', 'Do you wish to be considered for a scholars program such as the Undergraduate Research Center or the Multicultural Summer Institute?', false),
  ] }),
  'Pitzer College': commonAppForm('Pitzer College', { plans: PLANS.ed2, testing: 'blind', learnedAbout: true, extraGeneral: [
    yn('claremontConsortium', 'Pitzer students cross-register across the five Claremont Colleges. Would you like information about consortium study?', false),
  ] }),
  'Scripps College': commonAppForm('Scripps College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraGeneral: [
    yn('claremontConsortium', 'Scripps students cross-register across the five Claremont Colleges. Would you like information about consortium study?', false),
  ], extraAcademics: [
    ynSelect('scrippsJamesScholars', 'Do you wish to be considered for the James E. Scripps Scholarship or another merit award? These require an additional essay.', false),
  ] }),
  'Trinity College': commonAppForm('Trinity College', { plans: PLANS.ed2Ea, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('trinityGuidedStudies', 'Do you wish to be considered for a gateway program such as Guided Studies, InterArts, the Cities Program or the Interdisciplinary Science Program?', false),
  ] }),
  'Union College': commonAppForm('Union College', { plans: PLANS.ed2Ea, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('unionLeadershipMedical', 'Do you wish to be considered for the Leadership in Medicine program or another accelerated graduate pathway? These require separate materials.', false),
  ] }),
  'University of Richmond': commonAppForm('the University of Richmond', { plans: PLANS.ed2Ea, testing: 'optional', housing: true, college: ['School of Arts and Sciences', 'Robins School of Business', 'Jepson School of Leadership Studies'], extraAcademics: [
    ynSelect('richmondScholars', 'Do you wish to be considered for the Richmond Scholars, Oliver Hill Scholars or Artist Scholars programs? These require additional essays and an interview.', false),
  ] }),
  'Washington and Lee University': commonAppForm('Washington and Lee University', { plans: PLANS.ed2, testing: 'optional', extraAcademics: [
    ynSelect('wluJohnsonScholarship', 'Do you wish to be considered for the Johnson Scholarship, which covers tuition, room and board? It requires a separate application with an earlier deadline.', false),
  ], extraGeneral: [
    yn('honorSystem', "Washington and Lee runs a student-administered Honor System with a single sanction: a violation means dismissal. I understand.", false),
  ] }),
  'Wheaton College': commonAppForm('Wheaton College', { plans: PLANS.ed2Ea, testing: 'optional', religion: true, learnedAbout: true, extraAcademics: [
    ynSelect('wheatonScholarship', 'Do you wish to be considered for a merit or departmental scholarship?', false),
  ] }),
  'Whitman College': commonAppForm('Whitman College', { plans: PLANS.ed2, testing: 'optional', learnedAbout: true, extraAcademics: [
    ynSelect('whitmanScholarship', 'Do you wish to be considered for a merit scholarship such as the Claire Sherwood Memorial or a departmental award? Some require an audition or portfolio.', false),
  ] }),
}
