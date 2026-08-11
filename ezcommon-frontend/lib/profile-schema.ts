export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'number'

export interface FieldDef {
  key: string
  /** Dictionary key path, e.g. "profile.personal.firstName" - resolved via useT(). */
  labelKey: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholderKey?: string
}

export interface FieldGroup {
  eyebrowKey?: string
  fields: FieldDef[]
}

export interface SimpleSectionDef {
  kind: 'simple'
  groups: FieldGroup[]
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
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']
const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Prefer not to say',
]
const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say']
const DEGREE_OPTIONS = ['Less than high school', 'High school diploma', "Associate's", "Bachelor's", "Master's", 'Doctorate']

export const PROFILE_SECTIONS: ProfileSectionMeta[] = [
  {
    key: 'personal',
    labelKey: 'profile.sections.personal',
    def: {
      kind: 'simple',
      groups: [
        {
          eyebrowKey: 'profile.personal.legalNameEyebrow',
          fields: [
            { key: 'firstName', labelKey: 'profile.personal.firstName', type: 'text', required: true },
            { key: 'lastName', labelKey: 'profile.personal.lastName', type: 'text', required: true },
          ],
        },
        {
          eyebrowKey: 'profile.personal.detailsEyebrow',
          fields: [
            { key: 'gender', labelKey: 'profile.personal.gender', type: 'select', options: GENDER_OPTIONS },
            { key: 'dob', labelKey: 'profile.personal.dob', type: 'date' },
            { key: 'race', labelKey: 'profile.personal.race', type: 'select', options: RACE_OPTIONS },
            { key: 'sex', labelKey: 'profile.personal.sex', type: 'select', required: true, options: ['Male', 'Female'] },
            { key: 'pronouns', labelKey: 'profile.personal.pronouns', type: 'select', options: PRONOUN_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.personal.contactEyebrow',
          fields: [
            { key: 'email', labelKey: 'profile.personal.email', type: 'text' },
            { key: 'phone', labelKey: 'profile.personal.phone', type: 'text' },
            { key: 'address', labelKey: 'profile.personal.address', type: 'text' },
            { key: 'city', labelKey: 'profile.personal.city', type: 'text' },
            { key: 'state', labelKey: 'profile.personal.state', type: 'text' },
            { key: 'zip', labelKey: 'profile.personal.zip', type: 'text' },
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
          eyebrowKey: 'profile.family.parent1Eyebrow',
          fields: [
            { key: 'p1Name', labelKey: 'profile.family.fullName', type: 'text' },
            { key: 'p1Relationship', labelKey: 'profile.family.relationship', type: 'text' },
            { key: 'p1Occupation', labelKey: 'profile.family.occupation', type: 'text' },
            { key: 'p1Education', labelKey: 'profile.family.educationLevel', type: 'select', options: DEGREE_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.family.parent2Eyebrow',
          fields: [
            { key: 'p2Name', labelKey: 'profile.family.fullName', type: 'text' },
            { key: 'p2Relationship', labelKey: 'profile.family.relationship', type: 'text' },
            { key: 'p2Occupation', labelKey: 'profile.family.occupation', type: 'text' },
            { key: 'p2Education', labelKey: 'profile.family.educationLevel', type: 'select', options: DEGREE_OPTIONS },
          ],
        },
        {
          eyebrowKey: 'profile.family.householdEyebrow',
          fields: [
            { key: 'siblings', labelKey: 'profile.family.siblings', type: 'number' },
            { key: 'householdNotes', labelKey: 'profile.family.householdNotes', type: 'textarea' },
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
      groups: [
        {
          eyebrowKey: 'profile.education.currentSchoolEyebrow',
          fields: [
            { key: 'schoolName', labelKey: 'profile.education.schoolName', type: 'text' },
            { key: 'schoolAddress', labelKey: 'profile.education.schoolAddress', type: 'text' },
            { key: 'graduationDate', labelKey: 'profile.education.graduationDate', type: 'date' },
            { key: 'classRank', labelKey: 'profile.education.classRank', type: 'text', placeholderKey: 'profile.education.classRankPlaceholder' },
          ],
        },
        {
          eyebrowKey: 'profile.education.gpaEyebrow',
          fields: [
            { key: 'gpaUnweighted', labelKey: 'profile.education.gpaUnweighted', type: 'text', placeholderKey: 'profile.education.gpaUnweightedPlaceholder' },
            { key: 'gpaWeighted', labelKey: 'profile.education.gpaWeighted', type: 'text', placeholderKey: 'profile.education.gpaWeightedPlaceholder' },
            { key: 'gpaScale', labelKey: 'profile.education.gpaScale', type: 'text', placeholderKey: 'profile.education.gpaScalePlaceholder' },
          ],
        },
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
        { key: 'test', labelKey: 'profile.testing.test', type: 'select', options: ['SAT', 'ACT', 'AP', 'IB', 'TOEFL', 'IELTS'] },
        { key: 'date', labelKey: 'profile.testing.date', type: 'date' },
        { key: 'score', labelKey: 'profile.testing.score', type: 'text', placeholderKey: 'profile.testing.scorePlaceholder' },
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
            { key: 'careerInterests', labelKey: 'profile.academicInterests.careerInterests', type: 'textarea' },
            { key: 'academicNotes', labelKey: 'profile.academicInterests.academicNotes', type: 'textarea' },
          ],
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
        { key: 'name', labelKey: 'profile.activities.name', type: 'text' },
        { key: 'role', labelKey: 'profile.activities.role', type: 'text' },
        { key: 'gradeLevels', labelKey: 'profile.activities.gradeLevels', type: 'text', placeholderKey: 'profile.activities.gradeLevelsPlaceholder' },
        { key: 'hoursPerWeek', labelKey: 'profile.activities.hoursPerWeek', type: 'number' },
        { key: 'weeksPerYear', labelKey: 'profile.activities.weeksPerYear', type: 'number' },
        { key: 'description', labelKey: 'profile.activities.description', type: 'textarea' },
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
        { key: 'gradeLevel', labelKey: 'profile.honors.gradeLevel', type: 'text', placeholderKey: 'profile.honors.gradeLevelPlaceholder' },
        { key: 'level', labelKey: 'profile.honors.level', type: 'select', options: ['School', 'State/Regional', 'National', 'International'] },
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
  data: Record<string, string> | Record<string, string>[] | undefined,
  def: ProfileSectionDef,
): boolean {
  if (def.kind === 'repeatable') {
    return Array.isArray(data) && data.length > 0
  }
  const required = def.groups.flatMap((g) => g.fields).filter((f) => f.required)
  if (required.length === 0) {
    const values = Object.values((data as Record<string, string>) || {})
    return values.some((v) => v && v.trim())
  }
  return required.every((f) => (data as Record<string, string> | undefined)?.[f.key]?.trim())
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
