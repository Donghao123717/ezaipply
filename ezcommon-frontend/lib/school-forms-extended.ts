import type { FieldDef } from '@/lib/profile-schema'
import type { SchoolForm, SchoolFormPage } from '@/lib/school-forms'

/**
 * The eight schools EZCollegeApp's catalogue does not carry.
 *
 * Every other school on the list has its questions read off the school's own
 * live form - that is lib/school-forms-catalog.ts. These eight could not be:
 * Berea, BYU, two Cal States, San Diego State, CUNY City College and the two
 * satellite Rutgers campuses are simply absent from the source catalogue.
 * Rather than leave them on the generic placeholder, they are modelled from
 * what each school publishes and marked `verified: false`, so the UI tells the
 * student which of the two they are reading. A modelled question a school does
 * not actually ask costs an evening; the same question presented as verified
 * costs their trust in everything else here.
 *
 * Five of the eight do not use the Common Application at all, and that is the
 * most useful thing these entries carry: Cal State Apply requires no essay and
 * reads no test scores, one CUNY application covers six colleges ranked in
 * order, and BYU requires an ecclesiastical endorsement submitted by someone
 * other than the applicant. A Common App skeleton would have said none of that.
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

/**
 * A university that runs its own application portal rather than a shared one.
 *
 * The residency question leads because for a public university it is often the
 * largest single factor in the decision, and the essay fields are the school's
 * own prompts rather than a Common App personal statement - a student who
 * arrives with one 650-word essay and nothing else is not ready for these.
 */
function ownPortalForm(
  school: string,
  portal: string,
  opts: {
    essays?: FieldDef[]
    extraGeneral?: FieldDef[]
    extraAcademics?: FieldDef[]
    colleges?: string[]
    testing?: 'optional' | 'required'
    note?: string
  } = {},
): SchoolForm {
  const general: FieldDef[] = [
    sel('preferredStartTerm', 'Preferred start term', ['Fall', 'Spring', 'Summer']),
    sel('residency', 'Are you applying as an in-state resident for tuition purposes?', ['Yes', 'No', 'Unsure']),
  ]
  if (opts.testing !== 'required') {
    general.push(
      ynSelect(
        'testConsideration',
        `${school} is test-optional. Would you like your SAT and/or ACT scores considered in the review of your application?`,
      ),
    )
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
  if (opts.colleges) {
    academics.push(sel('collegeChoice', `Which college or school at ${school} are you applying to?`, opts.colleges))
  }
  academics.push(
    txt('firstChoiceMajor', 'What is your intended first-choice major?', true),
    txt('secondChoiceMajor', 'Second-choice major, if your first choice is full', false),
  )
  if (opts.extraAcademics) academics.push(...opts.extraAcademics)

  const pages: SchoolFormPage[] = [
    { key: 'general', label: 'General', kind: 'fields', fields: general },
    { key: 'academics', label: 'Academics', kind: 'fields', fields: academics },
  ]
  pages.push(
    opts.essays
      ? { key: 'essays', label: 'Essays', kind: 'fields', fields: opts.essays }
      : { key: 'writing', label: 'Writing', kind: 'writing' },
  )
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
  /* The eight schools EZCollegeApp's catalogue does not carry. Modelled from
     each school's published requirements, marked unverified, and kept apart
     from the read-off-the-form questions in lib/school-forms-catalog.ts. */

  'California State University, Fullerton': calStateForm('California State University, Fullerton', ['Fullerton']),
  'California State University, Long Beach': calStateForm('California State University, Long Beach', ['Long Beach']),
  'San Diego State University': calStateForm('San Diego State University', ['San Diego']),

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
}
