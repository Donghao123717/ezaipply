export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'radio' | 'checkbox-multi'

export interface FieldDef {
  key: string
  /** Dictionary key path, e.g. "profile.personalInfo.firstName" - resolved via useT(). */
  labelKey: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholderKey?: string
}

export interface FieldGroup {
  eyebrowKey?: string
  /** Translated paragraph shown above the group's fields, e.g. eligibility criteria text. */
  descriptionKey?: string
  /** If true, rendered inside the section's collapsed "Additional Information" panel instead of the main view. */
  additional?: boolean
  fields: FieldDef[]
}

/** A "+ Add X" repeatable card list embedded inside a `simple` section (e.g. Parent/Guardian inside Family). */
export interface NestedRepeatable {
  key: string
  labelKey: string
  itemLabelKey: string
  emptyLabelKey: string
  fields: FieldDef[]
  /** If true, rendered inside the section's collapsed "Additional Information" panel instead of the main view. */
  additional?: boolean
  maxItems?: number
}

export interface SimpleSectionDef {
  kind: 'simple'
  groups: FieldGroup[]
  nestedRepeatables?: NestedRepeatable[]
  /** Subtitle shown next to the "Additional Information" toggle - only used if any group/nestedRepeatable is marked `additional`. */
  additionalInfoSubtitleKey?: string
}

export interface RepeatableSectionDef {
  kind: 'repeatable'
  itemLabelKey: string
  emptyLabelKey: string
  fields: FieldDef[]
}

export type ProfileSectionDef = SimpleSectionDef | RepeatableSectionDef

export interface ProfileSectionMeta {
  key: string
  labelKey: string
  def: ProfileSectionDef
}

// Select options stay in English values (stable data), but are displayed via
// t(`common.options.${value}`) - see lib/i18n/dictionary.ts "options" namespace.
const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Prefer not to say',
]
const DEGREE_OPTIONS = ['Less than high school', 'High school diploma', "Associate's", "Bachelor's", "Master's", 'Doctorate']

// Common App's real Personal Information part uses a couple hundred
// countries and languages - we cover the common ones plus an "Other"
// catch-all rather than reproducing the full lists.
export const COUNTRY_OPTIONS = [
  'United States', 'China', 'India', 'South Korea', 'Japan', 'Canada', 'United Kingdom', 'Vietnam', 'Taiwan',
  'Hong Kong', 'Mexico', 'Brazil', 'Nigeria', 'Germany', 'France', 'Spain', 'Italy', 'Russia', 'Saudi Arabia',
  'United Arab Emirates', 'Turkey', 'Indonesia', 'Thailand', 'Philippines', 'Malaysia', 'Singapore', 'Pakistan',
  'Bangladesh', 'Sri Lanka', 'Nepal', 'Kazakhstan', 'Ukraine', 'Poland', 'Netherlands', 'Belgium', 'Switzerland',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Egypt', 'South Africa', 'Kenya',
  'Ghana', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Australia', 'New Zealand', 'Israel', 'Jordan', 'Iran',
  'Iraq', 'Other',
]
const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Cantonese', 'Spanish', 'Hindi', 'Arabic', 'Bengali', 'Portuguese', 'Russian',
  'Japanese', 'Korean', 'French', 'German', 'Vietnamese', 'Urdu', 'Indonesian', 'Italian', 'Turkish', 'Thai',
  'Tagalog/Filipino', 'Polish', 'Ukrainian', 'Dutch', 'Persian/Farsi', 'Punjabi', 'Tamil', 'Telugu', 'Marathi',
  'Gujarati', 'Swahili', 'Hebrew', 'Greek', 'Swedish', 'Malay', 'Other',
]
// No trailing periods - "common.options.<value>" is resolved by splitting on
// "." (see lib/i18n/use-t.ts), so a value containing a literal dot would
// break the dictionary lookup.
const SUFFIX_OPTIONS = ['Jr', 'Sr', 'II', 'III', 'IV']
const PHONE_TYPE_OPTIONS = ['Home', 'Mobile']
const GENDER_CHECKBOX_OPTIONS = ['Female', 'Male', 'Nonbinary']
const LEGAL_SEX_OPTIONS = ['Female', 'Male', 'X or another legal sex']
const PRONOUN_CHECKBOX_OPTIONS = ['He/Him', 'She/Her', 'They/Them']
const CITIZENSHIP_OPTIONS = [
  'U.S. citizen or U.S. national',
  'U.S. dual citizen',
  'U.S. permanent resident (green card holder)',
  'U.S. resident with other status',
  'Citizen of non-U.S. country',
]
const LANGUAGE_PROFICIENCY_OPTIONS = ['First Language', 'Speak', 'Read', 'Write', 'Spoken at Home']

// Education
const PROGRESSION_OPTIONS = [
  'Did or will graduate early',
  'Did or will graduate late',
  'Did or will take time off',
  'Did or will take gap year',
  'No change in progression',
]
const GPA_SCALE_REPORTING_OPTIONS = ['4.0', '4.3', '4.5', '5.0', '100-point', 'Other']
const SCHEDULING_SYSTEM_OPTIONS = ['Semester', 'Trimester', 'Quarter', 'Yearly']
const HONORS_GRADE_OPTIONS = ['9', '10', '11', '12', 'Post-graduate']
const START_TERM_OPTIONS = ['2026-27', '2028', '2029 or beyond', 'Already a college student']
const DEGREE_INTENT_OPTIONS = ["Bachelor's", "Master's", 'Doctorate', 'Professional degree (MD, JD, etc.)', 'Other']
const CAREER_OPTIONS = [
  'Undecided', 'Medicine/Healthcare', 'Engineering', 'Computer Science/Technology', 'Business/Finance', 'Law',
  'Education', 'Arts/Design', 'Science/Research', 'Social Work/Psychology', 'Government/Public Policy',
  'Journalism/Media', 'Architecture', 'Environmental Science', 'Agriculture', 'Hospitality/Tourism',
  'Non-profit/NGO', 'Military', 'Entrepreneurship', 'Other',
]

// Testing
const TEST_TYPE_OPTIONS = [
  'SAT', 'SAT Subject Test', 'ACT', 'AP', 'IB', 'Cambridge', 'TOEFL', 'PTE Academic', 'IELTS',
  'Duolingo English Test', 'Senior Secondary Leaving Examination',
]
const SCORE_TYPE_OPTIONS = ['Actual', 'Predicted']

// Activities and experiences
const ACTIVITY_TYPE_OPTIONS = [
  'Academic', 'Art', 'Athletics', 'Career Oriented', 'Community Service/Volunteer', 'Computer/Technology',
  'Cultural', 'Dance', 'Debate/Speech', 'Environmental', 'Family Responsibilities', 'Foreign Language',
  'Journalism/Publication', 'Music: Instrumental', 'Music: Vocal', 'Religious', 'Research', 'Robotics',
  'Science/Math', 'Student Government', 'Theater/Drama', 'Work (Paid)', 'Other',
]
const PARTICIPATION_GRADE_OPTIONS = ['9th grade', '10th grade', '11th grade', '12th grade', 'After graduating high school']
const CONTINUE_IN_COLLEGE_OPTIONS = ['Yes', 'No', 'Not sure']
const RESPONSIBILITIES_OPTIONS = [
  'Assisting family or household members with tasks such as doctors appointments, bank visits, or visa interviews',
  'Farm work or unpaid work for a family business',
  'Interpreting or translating for family or household members',
  'Managing family or household finances, budget, or paying bills',
  'Providing transportation for family or household members',
  'Taking care of sick, disabled, and/or elderly members of my family or household',
  'Taking care of younger family or household members',
  'Taking care of my own child or children',
  'Working at a paid job to contribute to my household income',
  'Other',
  'None of these',
]
const CIRCUMSTANCES_OPTIONS = [
  'Commuting 60 minutes or more to and from school each day',
  'Experiencing homelessness or another unstable living situation',
  'Living without consistent heat, power, water, or access to food',
  'Living without reliable or usable internet',
  'Living independently or living on my own (not including boarding school)',
  'None of these',
]
const TIMING_OF_PARTICIPATION_OPTIONS = ['During school year', 'During school break', 'All year']

// Personal Information / Family (EZCollegeApp-style, simplified)
const US_STATES_OPTIONS = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',
  'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'Not a U.S. resident',
]
const MARITAL_STATUS_OPTIONS = ['Married', 'Divorced', 'Separated', 'Never Married', 'Widowed', 'Domestic Partnership']
const PERMANENT_HOME_OPTIONS = ['Both parents', 'Mother', 'Father', 'Guardian', 'Split time', 'Other']
const PARENT_RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Stepmother', 'Stepfather', 'Guardian', 'Grandparent', 'Other']
const LIVING_STATUS_OPTIONS = ['Living', 'Deceased']
const GRADE_LEVEL_OPTIONS = ['9th', '10th', '11th', '12th']
const CLASS_YEAR_OPTIONS = ['2026', '2027', '2028', '2029']
const APPLICANT_ROUTE_OPTIONS = ['Early Decision', 'Early Action', 'Regular Decision', 'Rolling Admission']
const APPLICANT_TYPE_OPTIONS = ['First-Year', 'Transfer', 'International', 'Graduate']

export const PROFILE_SECTIONS: ProfileSectionMeta[] = [
  {
    key: 'personal-info',
    labelKey: 'profile.sections.personalInfo',
    def: {
      kind: 'simple',
      additionalInfoSubtitleKey: 'profile.personalInfo.additionalInfoSubtitle',
      groups: [
        {
          eyebrowKey: 'profile.personalInfo.legalNameEyebrow',
          fields: [
            { key: 'firstName', labelKey: 'profile.personalInfo.firstName', type: 'text', required: true },
            { key: 'lastName', labelKey: 'profile.personalInfo.lastName', type: 'text', required: true },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.detailsEyebrow',
          fields: [
            { key: 'gender', labelKey: 'profile.personalInfo.gender', type: 'select', options: GENDER_CHECKBOX_OPTIONS },
            { key: 'dob', labelKey: 'profile.personalInfo.dob', type: 'date', required: true },
            { key: 'race', labelKey: 'profile.personalInfo.race', type: 'select', options: RACE_OPTIONS },
            { key: 'sex', labelKey: 'profile.personalInfo.sex', type: 'select', required: true, options: LEGAL_SEX_OPTIONS },
            { key: 'pronouns', labelKey: 'profile.personalInfo.pronouns', type: 'select', options: PRONOUN_CHECKBOX_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.addressEyebrow',
          fields: [
            { key: 'country', labelKey: 'profile.personalInfo.country', type: 'select', required: true, options: COUNTRY_OPTIONS },
            { key: 'address', labelKey: 'profile.personalInfo.address', type: 'text', required: true },
            { key: 'hasAlternateAddress', labelKey: 'profile.personalInfo.hasAlternateAddress', type: 'radio', required: true, options: ['Yes', 'No'] },
            { key: 'inStateTuitionState', labelKey: 'profile.personalInfo.inStateTuitionState', type: 'select', required: true, options: US_STATES_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.nameDetailsEyebrow',
          additional: true,
          fields: [
            { key: 'preferredName', labelKey: 'profile.personalInfo.preferredName', type: 'text' },
            { key: 'middleName', labelKey: 'profile.personalInfo.middleName', type: 'text' },
            { key: 'suffix', labelKey: 'profile.personalInfo.suffix', type: 'select', options: SUFFIX_OPTIONS },
            { key: 'formerName', labelKey: 'profile.personalInfo.formerName', type: 'text' },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.contactEyebrow',
          additional: true,
          fields: [
            { key: 'preferredPhoneType', labelKey: 'profile.personalInfo.phoneType', type: 'radio', options: PHONE_TYPE_OPTIONS },
            { key: 'preferredPhoneNumber', labelKey: 'profile.personalInfo.preferredPhoneNumber', type: 'text' },
            { key: 'alternatePhoneType', labelKey: 'profile.personalInfo.phoneType', type: 'radio', options: PHONE_TYPE_OPTIONS },
            { key: 'alternatePhoneNumber', labelKey: 'profile.personalInfo.alternatePhoneNumber', type: 'text' },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.citizenshipEyebrow',
          additional: true,
          fields: [
            { key: 'citizenshipCountry', labelKey: 'profile.personalInfo.citizenshipCountry', type: 'select', options: COUNTRY_OPTIONS },
            { key: 'citizenshipStatus', labelKey: 'profile.personalInfo.citizenshipStatus', type: 'select', options: CITIZENSHIP_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.birthResidencyEyebrow',
          additional: true,
          fields: [
            { key: 'birthCountry', labelKey: 'profile.personalInfo.birthCountry', type: 'select', options: COUNTRY_OPTIONS },
            { key: 'birthCity', labelKey: 'profile.personalInfo.birthCity', type: 'text' },
            { key: 'birthState', labelKey: 'profile.personalInfo.birthState', type: 'text' },
            { key: 'yearsInUS', labelKey: 'profile.personalInfo.yearsInUS', type: 'number' },
          ],
        },
        {
          eyebrowKey: 'profile.personalInfo.travelDocumentsEyebrow',
          additional: true,
          fields: [
            { key: 'passportNumber', labelKey: 'profile.personalInfo.passportNumber', type: 'text' },
            { key: 'passportIssuanceCountry', labelKey: 'profile.personalInfo.passportIssuanceCountry', type: 'select', options: COUNTRY_OPTIONS },
            { key: 'passportIssuanceDate', labelKey: 'profile.personalInfo.passportIssuanceDate', type: 'date' },
            { key: 'passportExpirationDate', labelKey: 'profile.personalInfo.passportExpirationDate', type: 'date' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'languages',
          labelKey: 'profile.personalInfo.languagesLabel',
          itemLabelKey: 'profile.personalInfo.addLanguage',
          emptyLabelKey: 'profile.personalInfo.noLanguages',
          additional: true,
          maxItems: 5,
          fields: [
            { key: 'language', labelKey: 'profile.language.selectLanguage', type: 'select', options: LANGUAGE_OPTIONS },
            { key: 'proficiency', labelKey: 'profile.language.proficiency', type: 'checkbox-multi', options: LANGUAGE_PROFICIENCY_OPTIONS },
          ],
        },
      ],
    },
  },
  {
    key: 'family',
    labelKey: 'profile.sections.family',
    def: {
      kind: 'simple',
      groups: [
        {
          eyebrowKey: 'profile.family.householdEyebrow',
          fields: [
            { key: 'parentsMaritalStatus', labelKey: 'profile.family.parentsMaritalStatus', type: 'select', options: MARITAL_STATUS_OPTIONS },
            { key: 'permanentHomeWith', labelKey: 'profile.family.permanentHomeWith', type: 'select', options: PERMANENT_HOME_OPTIONS },
            { key: 'siblings', labelKey: 'profile.family.siblings', type: 'number' },
            { key: 'numChildren', labelKey: 'profile.family.numChildren', type: 'number' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'parents',
          labelKey: 'profile.family.parentsLabel',
          itemLabelKey: 'profile.family.addParent',
          emptyLabelKey: 'profile.family.noParents',
          fields: [
            { key: 'relationship', labelKey: 'profile.family.relationship', type: 'select', options: PARENT_RELATIONSHIP_OPTIONS },
            { key: 'livingStatus', labelKey: 'profile.family.livingStatus', type: 'select', options: LIVING_STATUS_OPTIONS },
            { key: 'highestEducation', labelKey: 'profile.family.educationLevel', type: 'select', options: DEGREE_OPTIONS },
            { key: 'firstName', labelKey: 'profile.family.firstName', type: 'text' },
            { key: 'lastName', labelKey: 'profile.family.lastName', type: 'text' },
            { key: 'dateOfBirth', labelKey: 'profile.family.dateOfBirth', type: 'date' },
            { key: 'email', labelKey: 'profile.family.email', type: 'text' },
            { key: 'phoneType', labelKey: 'profile.family.phoneType', type: 'radio', options: PHONE_TYPE_OPTIONS },
            { key: 'phoneNumber', labelKey: 'profile.family.phoneNumber', type: 'text' },
            { key: 'occupation', labelKey: 'profile.family.occupation', type: 'text' },
            { key: 'employer', labelKey: 'profile.family.employer', type: 'text' },
            { key: 'isEmployerCollege', labelKey: 'profile.family.isEmployerCollege', type: 'radio', options: ['Yes', 'No'] },
          ],
        },
      ],
    },
  },
  {
    key: 'education',
    labelKey: 'profile.sections.education',
    def: {
      kind: 'simple',
      additionalInfoSubtitleKey: 'profile.education.additionalInfoSubtitle',
      groups: [
        {
          eyebrowKey: 'profile.education.overviewEyebrow',
          fields: [
            { key: 'schoolName', labelKey: 'profile.education.schoolName', type: 'text', required: true },
            { key: 'grade', labelKey: 'profile.education.grade', type: 'select', required: true, options: GRADE_LEVEL_OPTIONS },
            { key: 'classYear', labelKey: 'profile.education.classYear', type: 'select', required: true, options: CLASS_YEAR_OPTIONS },
            { key: 'route', labelKey: 'profile.education.route', type: 'select', options: APPLICANT_ROUTE_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.education.recordEyebrow',
          fields: [
            { key: 'cumulativeGPA', labelKey: 'profile.grades.cumulativeGPA', type: 'text' },
            { key: 'gpaScale', labelKey: 'profile.grades.gpaScaleReporting', type: 'select', options: GPA_SCALE_REPORTING_OPTIONS },
            { key: 'classRank', labelKey: 'profile.education.classRank', type: 'text', placeholderKey: 'profile.education.classRankPlaceholder' },
          ],
        },
        {
          eyebrowKey: 'profile.education.schoolHistoryEyebrow',
          additional: true,
          fields: [
            { key: 'dateOfEntry', labelKey: 'profile.education.dateOfEntry', type: 'date' },
            { key: 'isBoardingSchool', labelKey: 'profile.education.isBoardingSchool', type: 'radio', options: ['Yes', 'No'] },
            { key: 'willGraduate', labelKey: 'profile.education.willGraduate', type: 'radio', options: ['Yes', 'No'] },
            { key: 'progression', labelKey: 'profile.education.progression', type: 'checkbox-multi', options: PROGRESSION_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.courses.eyebrow',
          additional: true,
          fields: [{ key: 'schedulingSystem', labelKey: 'profile.courses.schedulingSystem', type: 'radio', options: SCHEDULING_SYSTEM_OPTIONS }],
        },
        {
          eyebrowKey: 'profile.education.collegeCourseworkEyebrow',
          additional: true,
          fields: [{ key: 'anyCollegeCoursework', labelKey: 'profile.education.anyCollegeCoursework', type: 'radio', options: ['Yes', 'No'] }],
        },
        {
          eyebrowKey: 'profile.futurePlans.eyebrow',
          additional: true,
          fields: [
            { key: 'applicantType', labelKey: 'profile.futurePlans.applicantType', type: 'select', options: APPLICANT_TYPE_OPTIONS },
            { key: 'startTerm', labelKey: 'profile.futurePlans.startTerm', type: 'select', options: START_TERM_OPTIONS },
            { key: 'highestDegree', labelKey: 'profile.futurePlans.highestDegree', type: 'select', options: DEGREE_INTENT_OPTIONS },
            { key: 'careerInterest', labelKey: 'profile.futurePlans.careerInterest', type: 'select', options: CAREER_OPTIONS },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'otherSchools',
          labelKey: 'profile.otherSchools.label',
          itemLabelKey: 'profile.otherSchools.itemLabel',
          emptyLabelKey: 'profile.otherSchools.emptyLabel',
          additional: true,
          maxItems: 3,
          fields: [
            { key: 'schoolName', labelKey: 'profile.otherSchools.schoolName', type: 'text' },
            { key: 'fromDate', labelKey: 'profile.otherSchools.fromDate', type: 'date' },
            { key: 'toDate', labelKey: 'profile.otherSchools.toDate', type: 'date' },
            { key: 'reasonForLeaving', labelKey: 'profile.otherSchools.reasonForLeaving', type: 'textarea' },
          ],
        },
        {
          key: 'courses',
          labelKey: 'profile.courses.label',
          itemLabelKey: 'profile.courses.addCourse',
          emptyLabelKey: 'profile.courses.emptyLabel',
          additional: true,
          fields: [{ key: 'courseName', labelKey: 'profile.courses.courseName', type: 'text' }],
        },
      ],
    },
  },
  {
    key: 'honors',
    labelKey: 'profile.sections.honors',
    def: {
      kind: 'repeatable',
      itemLabelKey: 'profile.honors.itemLabel',
      emptyLabelKey: 'profile.honors.emptyLabel',
      fields: [
        { key: 'title', labelKey: 'profile.honors.title', type: 'text' },
        { key: 'gradeLevel', labelKey: 'profile.honors.gradeLevel', type: 'select', options: HONORS_GRADE_OPTIONS },
        { key: 'levels', labelKey: 'profile.honors.levels', type: 'select', options: ['School', 'State/Regional', 'National', 'International'] },
      ],
    },
  },
  {
    key: 'testing',
    labelKey: 'profile.sections.testing',
    def: {
      kind: 'repeatable',
      itemLabelKey: 'profile.testing.itemLabel',
      emptyLabelKey: 'profile.testing.emptyLabel',
      fields: [
        { key: 'testType', labelKey: 'profile.testing.testType', type: 'select', options: TEST_TYPE_OPTIONS },
        { key: 'dateTaken', labelKey: 'profile.testing.dateTaken', type: 'date' },
        { key: 'subject', labelKey: 'profile.testing.subject', type: 'text' },
        { key: 'score', labelKey: 'profile.testing.score', type: 'text', placeholderKey: 'profile.testing.scorePlaceholder' },
        { key: 'readingWritingScore', labelKey: 'profile.testing.readingWritingScore', type: 'text' },
        { key: 'mathScore', labelKey: 'profile.testing.mathScore', type: 'text' },
        { key: 'essayScore', labelKey: 'profile.testing.essayScore', type: 'text' },
        { key: 'examinationBoard', labelKey: 'profile.testing.examinationBoard', type: 'text' },
        { key: 'scoreType', labelKey: 'profile.testing.scoreType', type: 'radio', options: SCORE_TYPE_OPTIONS },
        { key: 'notes', labelKey: 'profile.testing.notes', type: 'text', placeholderKey: 'profile.testing.notesPlaceholder' },
      ],
    },
  },
  {
    key: 'academic-interests',
    labelKey: 'profile.sections.academicInterests',
    def: {
      kind: 'simple',
      groups: [
        {
          eyebrowKey: 'profile.academicInterests.eyebrow',
          fields: [
            { key: 'intendedMajor', labelKey: 'profile.academicInterests.intendedMajor', type: 'text', placeholderKey: 'profile.academicInterests.intendedMajorPlaceholder' },
            { key: 'undecidedAboutMajor', labelKey: 'profile.academicInterests.undecidedAboutMajor', type: 'radio', options: ['Yes', 'No'] },
            { key: 'secondChoiceMajor', labelKey: 'profile.academicInterests.secondChoiceMajor', type: 'text', placeholderKey: 'profile.academicInterests.secondChoiceMajorPlaceholder' },
          ],
        },
      ],
      nestedRepeatables: [
        {
          key: 'additionalInterests',
          labelKey: 'profile.academicInterests.additionalInterestsLabel',
          itemLabelKey: 'profile.academicInterests.addInterest',
          emptyLabelKey: 'profile.academicInterests.noInterests',
          fields: [{ key: 'interest', labelKey: 'profile.academicInterests.interest', type: 'text' }],
        },
      ],
    },
  },
  {
    key: 'activities',
    labelKey: 'profile.sections.activities',
    def: {
      kind: 'repeatable',
      itemLabelKey: 'profile.activities.itemLabel',
      emptyLabelKey: 'profile.activities.emptyLabel',
      fields: [
        { key: 'activityType', labelKey: 'profile.activities.activityType', type: 'select', options: ACTIVITY_TYPE_OPTIONS },
        { key: 'description', labelKey: 'profile.activities.description', type: 'textarea', placeholderKey: 'profile.activities.descriptionPlaceholder' },
        { key: 'orgName', labelKey: 'profile.activities.orgName', type: 'text' },
        { key: 'hasLeadershipRole', labelKey: 'profile.activities.hasLeadershipRole', type: 'radio', options: ['Yes', 'No'] },
        { key: 'participationGrades', labelKey: 'profile.activities.participationGrades', type: 'checkbox-multi', options: PARTICIPATION_GRADE_OPTIONS },
        { key: 'timingOfParticipation', labelKey: 'profile.activities.timingOfParticipation', type: 'checkbox-multi', options: TIMING_OF_PARTICIPATION_OPTIONS },
        { key: 'hoursPerWeek', labelKey: 'profile.activities.hoursPerWeek', type: 'number' },
        { key: 'weeksPerYear', labelKey: 'profile.activities.weeksPerYear', type: 'number' },
        { key: 'continuePlanInCollege', labelKey: 'profile.activities.continuePlanInCollege', type: 'radio', options: CONTINUE_IN_COLLEGE_OPTIONS },
      ],
    },
  },
  {
    key: 'responsibilities-circumstances',
    labelKey: 'profile.sections.responsibilitiesCircumstances',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'profile.responsibilitiesCircumstances.intro',
          eyebrowKey: 'profile.responsibilitiesCircumstances.responsibilitiesEyebrow',
          fields: [{ key: 'responsibilities', labelKey: 'profile.responsibilitiesCircumstances.responsibilities', type: 'checkbox-multi', options: RESPONSIBILITIES_OPTIONS }],
        },
        {
          eyebrowKey: 'profile.responsibilitiesCircumstances.circumstancesEyebrow',
          fields: [{ key: 'circumstances', labelKey: 'profile.responsibilitiesCircumstances.circumstances', type: 'checkbox-multi', options: CIRCUMSTANCES_OPTIONS }],
        },
      ],
    },
  },
  {
    key: 'additional-information',
    labelKey: 'profile.sections.additionalInformation',
    def: {
      kind: 'simple',
      groups: [
        {
          descriptionKey: 'profile.additionalInformation.intro',
          fields: [
            { key: 'hasChallenges', labelKey: 'profile.additionalInformation.hasChallenges', type: 'radio', options: ['Yes', 'No'] },
            { key: 'challengesDetails', labelKey: 'profile.additionalInformation.challengesDetails', type: 'textarea' },
          ],
        },
        {
          fields: [
            { key: 'hasAdditionalDetails', labelKey: 'profile.additionalInformation.hasAdditionalDetails', type: 'radio', options: ['Yes', 'No'] },
            { key: 'additionalDetailsText', labelKey: 'profile.additionalInformation.additionalDetailsText', type: 'textarea' },
          ],
        },
      ],
    },
  },
]

function profileStorageKey(userId: string) {
  return `aipply-profile-${userId}`
}

export function loadProfileData(userId: string): Record<string, Record<string, string> | Record<string, string>[]> {
  try {
    const raw = window.localStorage.getItem(profileStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function isProfileSectionComplete(
  data: Record<string, any> | Record<string, string>[] | undefined,
  def: ProfileSectionDef,
): boolean {
  if (def.kind === 'repeatable') {
    return Array.isArray(data) && data.length > 0
  }
  // Only look at known flat field keys - a simple section's data object may
  // also hold nested repeatable arrays (see NestedRepeatable) under other
  // keys, which don't gate completion and aren't strings to .trim().
  const allFields = def.groups.flatMap((g) => g.fields)
  const required = allFields.filter((f) => f.required)
  const record = (data as Record<string, any>) || {}
  if (required.length === 0) {
    return allFields.some((f) => typeof record[f.key] === 'string' && record[f.key].trim())
  }
  return required.every((f) => typeof record[f.key] === 'string' && record[f.key].trim())
}

export interface ProfileSectionStatus {
  key: string
  labelKey: string
  complete: boolean
}

/** Real-time "how much of the Common Profile is filled in" - powers both the Profile page's own progress bar and the Counselor's Application Tracker. */
export function computeProfileSectionsProgress(userId: string): { completed: number; total: number; sections: ProfileSectionStatus[] } {
  const data = loadProfileData(userId)
  const sections = PROFILE_SECTIONS.map((s) => ({
    key: s.key,
    labelKey: s.labelKey,
    complete: isProfileSectionComplete(data[s.key], s.def),
  }))
  return { completed: sections.filter((s) => s.complete).length, total: sections.length, sections }
}

export interface FieldSchemaEntry {
  section: string
  field: string
  label: string
  type: FieldType
  options?: string[]
  /** True for a repeatable-list field (top-level repeatable section, or a nested repeatable inside a simple section). */
  repeatable?: boolean
  /** Set only when this field lives inside a `nestedRepeatables` list within a `simple` section (e.g. Family's Parent/Guardian). */
  nestedKey?: string
}

/**
 * Flattens every profile field into a schema-aware list the backend's
 * document extraction endpoint can target directly (see
 * ezcommon-backend/services/intelligent_extractor_service.py
 * extract_field_suggestions). Simple-section fields are flat targets;
 * repeatable-section and nested-repeatable fields are marked `repeatable`
 * so the LLM groups them per-record (via an `item` index) instead of
 * merging them into a single flat object.
 */
export function buildFieldSchema(t: (key: string) => string): FieldSchemaEntry[] {
  const entries: FieldSchemaEntry[] = []
  for (const section of PROFILE_SECTIONS) {
    if (section.def.kind === 'repeatable') {
      for (const field of section.def.fields) {
        entries.push({
          section: section.key,
          field: field.key,
          label: t(field.labelKey),
          type: field.type,
          options: field.options,
          repeatable: true,
        })
      }
      continue
    }
    for (const group of section.def.groups) {
      for (const field of group.fields) {
        entries.push({ section: section.key, field: field.key, label: t(field.labelKey), type: field.type, options: field.options })
      }
    }
    for (const nested of section.def.nestedRepeatables || []) {
      for (const field of nested.fields) {
        entries.push({
          section: section.key,
          // Prefixed so it can't collide with a same-named flat field on the same
          // section (e.g. education.schoolName exists both as the main field and
          // inside the nestedRepeatable "otherSchools") - see applySuggestions,
          // which strips the "<nestedKey>." prefix back off before writing.
          field: `${nested.key}.${field.key}`,
          label: t(field.labelKey),
          type: field.type,
          options: field.options,
          repeatable: true,
          nestedKey: nested.key,
        })
      }
    }
  }
  return entries
}
