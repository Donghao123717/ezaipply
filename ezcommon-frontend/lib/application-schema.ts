import type { FieldGroup } from '@/lib/profile-schema'

export interface ApplicationPageDef {
  key: string
  label: string
  kind: 'fields' | 'writing' | 'profile-pull' | 'notes'
  groups?: FieldGroup[]
  /** For kind === 'profile-pull': which lib/profile-schema.ts section(s) to mirror read-only. */
  profileSections?: string[]
}

// A generic application-form template applied to every saved school (see
// lib/profile-schema.ts for the same FieldDef/FieldGroup shape). This is
// intentionally school-agnostic - a real per-school Common App question
// bank needs licensed/sourced data this demo doesn't have.
export const APPLICATION_PAGES: ApplicationPageDef[] = [
  {
    key: 'general',
    label: 'General',
    kind: 'fields',
    groups: [
      {
        fields: [
          {
            key: 'startTerm',
            label: 'Preferred start term',
            type: 'select',
            required: true,
            options: ['Fall', 'Spring', 'Summer'],
          },
          {
            key: 'residence',
            label: 'Preferred residence during your first year',
            type: 'select',
            required: true,
            options: ['On-campus housing', 'Off-campus / commuter', 'Undecided'],
          },
          {
            key: 'financialAid',
            label: 'Do you intend to pursue need-based financial aid?',
            type: 'select',
            required: true,
            options: ['Yes', 'No'],
          },
          {
            key: 'firstGen',
            label: 'Are you a first-generation college student in your family?',
            type: 'select',
            required: true,
            options: ['Yes', 'No'],
          },
          {
            key: 'meritScholarship',
            label: 'Would you like to be considered for merit-based scholarships?',
            type: 'select',
            options: ['Yes', 'No'],
          },
        ],
      },
    ],
  },
  {
    key: 'academics',
    label: 'Academics',
    kind: 'fields',
    groups: [
      {
        fields: [
          {
            key: 'intendedDivision',
            label: 'Which academic division or school are you applying to?',
            type: 'select',
            required: true,
            options: ['Arts & Sciences', 'Engineering', 'Business', 'Nursing / Health Sciences', 'Undecided'],
          },
          {
            key: 'doubleMajor',
            label: 'Do you plan to pursue a double major or minor?',
            type: 'select',
            options: ['Yes', 'No', 'Not sure yet'],
          },
          {
            key: 'testingPolicy',
            label: 'How would you like standardized testing considered?',
            type: 'select',
            required: true,
            options: ['Submitting SAT/ACT scores', 'Test-optional - not submitting', 'Test scores not yet available'],
          },
        ],
      },
    ],
  },
  { key: 'writing', label: 'Writing', kind: 'writing' },
  { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
  { key: 'contacts', label: 'Contacts', kind: 'profile-pull', profileSections: ['personal'] },
  { key: 'family', label: 'Family', kind: 'profile-pull', profileSections: ['family'] },
  { key: 'additional', label: 'Additional Questions', kind: 'notes' },
]
