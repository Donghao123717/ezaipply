import type { FieldGroup } from '@/lib/profile-schema'
import { getSchoolForm } from '@/lib/school-forms'

export interface ApplicationPageDef {
  key: string
  /** Dictionary key for our own generic page names. */
  labelKey?: string
  /** The school's own page name, used verbatim when this form came from a school. */
  label?: string
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
  { key: 'contacts', labelKey: 'applicationForm.pages.contacts', kind: 'profile-pull', profileSections: ['personal-info'] },
  { key: 'family', labelKey: 'applicationForm.pages.family', kind: 'profile-pull', profileSections: ['family'] },
  { key: 'additional', labelKey: 'applicationForm.pages.additional', kind: 'notes' },
]

/**
 * The form to show for one school, in one of three states: read off the
 * school's live application (`verified`), modelled from what the school
 * publishes (`isReal` without `verified`), or the generic template. Callers
 * have to distinguish all three, because claiming a placeholder - or a
 * modelled form - is the real thing is worse than admitting the gap.
 */
export function getApplicationPages(schoolName: string | undefined): {
  pages: ApplicationPageDef[]
  isReal: boolean
  /** True only when isReal and the questions were read off the school's live form. */
  verified: boolean
  intro?: string
  cycle?: string
  sourceNote?: string
} {
  const form = schoolName ? getSchoolForm(schoolName) : undefined
  if (!form) return { pages: APPLICATION_PAGES, isReal: false, verified: false }

  return {
    pages: form.pages.map((page) => ({
      key: page.key,
      label: page.label,
      kind: page.kind,
      groups: page.fields ? [{ fields: page.fields }] : undefined,
      profileSections: page.profileSections,
    })),
    isReal: true,
    verified: form.verified,
    cycle: form.cycle,
    sourceNote: form.sourceNote,
  }
}

/** A page's display name - the school's own wording wins over our dictionary. */
export function applicationPageLabel(page: ApplicationPageDef, t: (key: string) => string): string {
  if (page.label) return page.label
  return page.labelKey ? t(page.labelKey) : page.key
}
