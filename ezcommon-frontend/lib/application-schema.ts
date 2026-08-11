import type { FieldGroup } from '@/lib/profile-schema'

export interface ApplicationPageDef {
  key: string
  labelKey: string
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
    labelKey: 'applicationForm.pages.general',
    kind: 'fields',
    groups: [
      {
        fields: [
          {
            key: 'startTerm',
            labelKey: 'applicationForm.fields.startTerm',
            type: 'select',
            required: true,
            options: ['Fall', 'Spring', 'Summer'],
          },
          {
            key: 'residence',
            labelKey: 'applicationForm.fields.residence',
            type: 'select',
            required: true,
            options: ['On-campus housing', 'Off-campus / commuter', 'Undecided'],
          },
          {
            key: 'financialAid',
            labelKey: 'applicationForm.fields.financialAid',
            type: 'select',
            required: true,
            options: ['Yes', 'No'],
          },
          {
            key: 'firstGen',
            labelKey: 'applicationForm.fields.firstGen',
            type: 'select',
            required: true,
            options: ['Yes', 'No'],
          },
          {
            key: 'meritScholarship',
            labelKey: 'applicationForm.fields.meritScholarship',
            type: 'select',
            options: ['Yes', 'No'],
          },
        ],
      },
    ],
  },
  {
    key: 'academics',
    labelKey: 'applicationForm.pages.academics',
    kind: 'fields',
    groups: [
      {
        fields: [
          {
            key: 'intendedDivision',
            labelKey: 'applicationForm.fields.intendedDivision',
            type: 'select',
            required: true,
            options: ['Arts & Sciences', 'Engineering', 'Business', 'Nursing / Health Sciences', 'Undecided'],
          },
          {
            key: 'doubleMajor',
            labelKey: 'applicationForm.fields.doubleMajor',
            type: 'select',
            options: ['Yes', 'No', 'Not sure yet'],
          },
          {
            key: 'testingPolicy',
            labelKey: 'applicationForm.fields.testingPolicy',
            type: 'select',
            required: true,
            options: ['Submitting SAT/ACT scores', 'Test-optional - not submitting', 'Test scores not yet available'],
          },
        ],
      },
    ],
  },
  { key: 'writing', labelKey: 'applicationForm.pages.writing', kind: 'writing' },
  { key: 'activities', labelKey: 'applicationForm.pages.activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
  { key: 'contacts', labelKey: 'applicationForm.pages.contacts', kind: 'profile-pull', profileSections: ['personal'] },
  { key: 'family', labelKey: 'applicationForm.pages.family', kind: 'profile-pull', profileSections: ['family'] },
  { key: 'additional', labelKey: 'applicationForm.pages.additional', kind: 'notes' },
]
