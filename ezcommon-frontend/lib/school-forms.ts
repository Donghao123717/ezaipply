import type { FieldDef } from '@/lib/profile-schema'

/**
 * Per-school application forms.
 *
 * Every U.S. school that accepts the Common App adds its own member questions
 * on top of the shared application, and they differ a lot: the set of pages is
 * not the same school to school, the question count ranges from a handful to
 * thirty, and the wording is the school's own. A single generic template - what
 * this app shipped before - tells a student almost nothing about what they will
 * actually be asked.
 *
 * So questions here carry `label` rather than `labelKey`: they are reproduced
 * in the asking school's own words, because a student who drafts against a
 * translated paraphrase has not prepared the answer they will paste. Our own
 * chrome around them stays translated.
 *
 * Schools without an entry fall back to the generic template in
 * lib/application-schema.ts, which is honestly labelled as a placeholder.
 *
 * Re-verify each cycle: schools revise these questions annually.
 */

export interface SchoolFormPage {
  key: string
  /** The school's own page name ("General", "Academics"). Not translated. */
  label: string
  kind: 'fields' | 'writing' | 'profile-pull' | 'notes'
  fields?: FieldDef[]
  /** For kind === 'profile-pull': which lib/profile-schema.ts sections to mirror read-only. */
  profileSections?: string[]
}

export interface SchoolForm {
  /** Message the school puts at the top of its own section, verbatim, if any. */
  intro?: string
  pages: SchoolFormPage[]
  cycle: string
  sourceNote: string
}

const YES_NO = ['Yes', 'No']

/** Harvard asks for up to ten prior residences, each its own capped line. */
function residenceLines(count: number): FieldDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `residence${i + 1}`,
    label:
      i === 0
        ? 'Please list the cities, states and countries where you have lived, with years of residence. Please list each location on a separate line with dates following (e.g., City, State, Country, mm/yyyy - mm/yyyy).'
        : 'Please list additional location and date if applicable.',
    type: 'textarea' as const,
    maxChars: 400,
  }))
}

export const SCHOOL_FORMS: Record<string, SchoolForm> = {
  'Harvard University': {
    cycle: '2026-27',
    sourceNote: "Harvard's Common App member questions, as published on the application.",
    pages: [
      {
        key: 'general',
        label: 'General',
        kind: 'fields',
        fields: [
          {
            key: 'startTerm',
            label: 'Preferred start term',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: ['Fall 2027', 'Spring 2028'],
          },
          {
            key: 'residencePreference',
            label: 'Preferred residence during your first year',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: ['On-campus housing', 'Commuter from home', 'Undecided'],
          },
          {
            key: 'financialAid',
            label: 'Do you intend to apply for need-based financial aid?',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
          {
            key: 'supplementaryMedia',
            label:
              'Do you intend to submit supplementary media materials (video, audio, images) to be considered with your application?',
            help:
              'Portfolio materials can illustrate special talents in academics or in one or more of the arts. Supplementary materials are neither expected nor required. These materials should be included only if you think they would significantly add to your application. If yes, you will be directed to upload these materials through Slideroom. If you intend to submit documents only (i.e., PDFs, word documents), these should be uploaded through the applicant portal, in which case you can select "no" for this question.',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
          {
            key: 'satActPlan',
            label: 'Did you or do you plan to take the SAT or ACT?',
            help:
              'Harvard requires the SAT or ACT to meet its standardized testing requirement. More information about the standardized testing requirement is available on its website.',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
        ],
      },
      {
        key: 'otherInformation',
        label: 'Other Information',
        kind: 'fields',
        fields: [
          ...residenceLines(10),
          {
            key: 'disciplinaryViolation',
            label:
              'Have you ever been found responsible for a disciplinary violation at any educational institution you have attended from the ninth grade (or the international equivalent) forward, whether related to academic misconduct or behavioral misconduct, that resulted in a disciplinary action?',
            help:
              'The existence of a disciplinary violation will not automatically disqualify anyone from admission. As with all information provided in the application, it is considered in the context of a whole person review; the details of the incident from your perspective are what matter.',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
          {
            key: 'criminalConviction',
            label:
              'Have you ever been convicted of, or pled guilty or no contest to, any felony or misdemeanor?',
            help:
              'Excluding: an arrest or other detention that did not result in a conviction, or in which a conviction was vacated; a first conviction for any of the following misdemeanors - drunkenness, simple assault, speeding, minor traffic violations, affray or disturbance of the peace; or any misdemeanor conviction that occurred more than five years before your application for admission, unless you were also sentenced to imprisonment, or were convicted of any additional offense within the five year period. You are not required to answer "yes", or provide an explanation, if the adjudication or conviction has been expunged, sealed, annulled, pardoned, destroyed, erased, impounded, or otherwise ordered by a court to be kept confidential.',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
          {
            key: 'militaryService',
            label: 'Are you currently serving or have you previously served in the U.S. Armed Forces?',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
        ],
      },
      { key: 'academics', label: 'Academics', kind: 'profile-pull', profileSections: ['education', 'testing'] },
      { key: 'writing', label: 'Writing', kind: 'writing' },
      { key: 'activities', label: 'Activities', kind: 'profile-pull', profileSections: ['activities', 'honors'] },
      { key: 'contacts', label: 'Contacts', kind: 'profile-pull', profileSections: ['personal-info'] },
      { key: 'family', label: 'Family', kind: 'profile-pull', profileSections: ['family'] },
      { key: 'additional', label: 'Additional', kind: 'notes' },
    ],
  },

  'Duke University': {
    cycle: '2026-27',
    sourceNote: "Duke's Common App member questions, as published on the application.",
    intro:
      'Thank you for applying to Duke; we appreciate that you are considering us among your college choices. As you fill out the application and consider your answers to the various prompts and questions, we want to assure you that real people are reading what you write, and we are trying our best to understand you as the unique person you are. And we wish you much success in the college application process.',
    pages: [
      {
        key: 'general',
        label: 'General',
        kind: 'fields',
        fields: [
          {
            key: 'startTerm',
            label: 'Preferred start term',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: ['Fall 2027'],
          },
          {
            key: 'undergraduateProgram',
            label: 'Undergraduate program',
            help: 'Duke asks applicants to choose between its two undergraduate schools.',
            type: 'select',
            required: true,
            optionsLiteral: true,
            options: ['Trinity College of Arts & Sciences', 'Pratt School of Engineering'],
          },
          {
            key: 'financialAid',
            label: 'Do you intend to pursue need-based financial aid?',
            type: 'radio',
            required: true,
            optionsLiteral: true,
            options: YES_NO,
          },
          {
            key: 'feeWaiver',
            label: 'Are you requesting an application fee waiver?',
            help:
              'If the application fee is a barrier, a waiver can be requested through the Common App Fee Waiver section of your Profile, or by asking your counselor to confirm eligibility.',
            type: 'radio',
            optionsLiteral: true,
            options: YES_NO,
          },
        ],
      },
      { key: 'academics', label: 'Academics', kind: 'profile-pull', profileSections: ['education', 'testing'] },
      { key: 'writing', label: 'Writing', kind: 'writing' },
      { key: 'contacts', label: 'Contacts', kind: 'profile-pull', profileSections: ['personal-info'] },
      { key: 'family', label: 'Family', kind: 'profile-pull', profileSections: ['family'] },
      { key: 'additional', label: 'Additional', kind: 'notes' },
    ],
  },
}

export function getSchoolForm(schoolName: string): SchoolForm | undefined {
  return SCHOOL_FORMS[schoolName]
}

/** How many schools have a real form, for the coverage note in the UI. */
export const SCHOOL_FORM_COUNT = Object.keys(SCHOOL_FORMS).length
