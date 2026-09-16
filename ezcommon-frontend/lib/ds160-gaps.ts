import { DS160_SECTIONS, type FieldDef, type Ds160SectionMeta } from '@/lib/ds160-schema'
import { fieldLabel } from '@/lib/profile-schema'
import type { Ds160Data } from '@/lib/ds160-store'

/**
 * Which DS-160 fields are still unanswered, in the order the form asks them.
 *
 * The model does not get to decide what to ask next. A model walking its own
 * way through two hundred and thirty-one fields wanders, asks the same thing
 * twice, and quietly skips the ones that decide the case; the form's own order
 * is already a considered sequence and it is free to follow. So this picks the
 * next few fields deterministically and the model's job is only to put them
 * into a sentence and read the reply back.
 */

export interface Gap {
  section: string
  field: string
  label: string
  type: string
  options: string[]
  required: boolean
  help: string
}

/** Pages that are not questions to ask - they are ours, or they are a checklist. */
const SKIP_SECTIONS = new Set(['setup', 'photo'])

/**
 * The security and background pages, which are answered "No" for almost every
 * applicant and are pre-answered that way when the form loads.
 *
 * They are not skipped here - every question on the form gets checked, and one
 * that is somehow blank should still be asked. They are simply never blank in
 * practice, so they never come up. This set exists only to keep three dozen
 * "No"s out of the context we send the model, where they say nothing about who
 * the applicant is and crowd out what does.
 */
const PRE_ANSWERED_NO = new Set(['security1', 'security2', 'security3', 'security4', 'security5'])

/**
 * Questions the form only asks when an earlier answer opens them.
 *
 * Asking someone who has never been to the United States when they last
 * arrived is not a gap in their application, it is a question that does not
 * exist for them - and a visitor who has not booked anything yet should never
 * be asked their flight number. The real form branches here; ours did not, so
 * it kept coming back to fields the applicant had already ruled out.
 *
 * Keyed "section.field", and read as: only ask this if that field says this.
 */
const DEPENDS_ON: Record<string, { section: string; field: string; equals: string }> = {}

function dependOn(section: string, parent: string, equals: string, children: string[]) {
  for (const child of children) {
    DEPENDS_ON[`${section}.${child}`] = { section, field: parent, equals }
  }
}

// Specific travel plans: with none made, the form wants an intended date and
// nothing that presupposes a booking.
dependOn('travel', 'hasSpecificPlans', 'Yes', [
  'arrivalFlight',
  'arrivalCity',
  'departureDate',
  'departureFlight',
  'departureCity',
])
dependOn('previousTravel', 'hasBeenToUS', 'Yes', ['dateArrived', 'lengthOfStay'])
dependOn('previousTravel', 'hasPriorVisa', 'Yes', [
  'lastVisaDate',
  'visaNumber',
  'sameVisaType',
  'sameCountryAsBefore',
  'tenPrinted',
  'visaLostOrStolen',
  'visaCancelledOrRevoked',
])
dependOn('companions', 'hasCompanions', 'Yes', ['travelingAsGroup'])

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function gapFrom(sectionKey: string, field: FieldDef, t: (key: string) => string): Gap {
  return {
    section: sectionKey,
    field: field.key,
    label: fieldLabel(field, t),
    type: field.type || 'text',
    options: field.options || [],
    required: !!field.required,
    help: field.help || '',
  }
}

/** Every unanswered field, form order, skipping the pages above. */
export function findGaps(
  data: Ds160Data,
  t: (key: string) => string,
  visibleSections?: Ds160SectionMeta[],
  /** Fields the applicant has already been asked and ruled out. */
  declined?: Set<string>,
): Gap[] {
  const sections = visibleSections || DS160_SECTIONS
  const gaps: Gap[] = []

  for (const section of sections) {
    if (SKIP_SECTIONS.has(section.key)) continue
    if (section.def.kind !== 'simple') continue
    const sectionData = (data[section.key] as Record<string, any>) || {}

    for (const group of section.def.groups) {
      for (const field of group.fields) {
        // Anything a document already answered is not a gap - that is the whole
        // point of reading the passport and the I-20 first, and it is why an
        // applicant who uploads their paperwork is never asked their passport
        // number or their SEVIS ID.
        if (!isEmpty(sectionData[field.key])) continue
        // Already asked, and the answer was that it does not apply. Coming back
        // to it is the single thing that made the conversation feel broken:
        // "no, I don't have one" and then, two questions later, the same
        // question again.
        if (declined?.has(`${section.key}.${field.key}`)) continue
        // A question the form only opens when an earlier answer opens it.
        const gate = DEPENDS_ON[`${section.key}.${field.key}`]
        if (gate) {
          const parent = (data[gate.section] as Record<string, any>)?.[gate.field]
          if (parent !== gate.equals) continue
        }
        // An explanation only exists because of a Yes above it. Asking "please
        // explain" of someone who answered No is asking about nothing.
        if (/explain|explanation/i.test(field.key) && !hasYesInSection(sectionData)) continue
        gaps.push(gapFrom(section.key, field, t))
      }
    }
  }
  return gaps
}

function hasYesInSection(sectionData: Record<string, any>): boolean {
  return Object.values(sectionData).some((v) => typeof v === 'string' && v === 'Yes')
}

/**
 * Fields that belong in one question, because a person answers them in one
 * breath.
 *
 * "Who is your contact in the US, what is their relationship to you, and where
 * do they live?" is one question that fills six boxes. Asked as six questions
 * it is an interrogation, and asked four-at-a-time by position it splits a
 * street address across two turns. The form's own page order is followed; only
 * the grouping within a page is set here.
 *
 * A page with no clusters is asked as one question if it is small, or in
 * capped runs if it is not.
 */
const ASK_CLUSTERS: Record<string, string[][]> = {
  personal1: [
    ['surnames', 'givenNames', 'fullNameNativeAlphabet', 'hasOtherNames', 'hasTelecode'],
    ['sex', 'maritalStatus', 'dob'],
    ['birthCity', 'birthState', 'birthCountry'],
    ['nationality', 'hasOtherNationality', 'isPermanentResidentElsewhere'],
    ['nationalIdNumber', 'usSSN', 'usTaxpayerId'],
  ],
  travel: [
    ['purposeClass', 'specify'],
    ['hasSpecificPlans', 'arrivalDate', 'arrivalFlight', 'arrivalCity'],
    ['departureDate', 'departureFlight', 'departureCity'],
    ['stayStreetAddress1', 'stayStreetAddress2', 'stayCity', 'stayState', 'stayZip'],
    ['payer'],
  ],
  previousTravel: [
    ['hasBeenToUS', 'dateArrived', 'lengthOfStay'],
    ['hasDriversLicense'],
    ['hasPriorVisa', 'lastVisaDate', 'visaNumber', 'sameVisaType', 'sameCountryAsBefore', 'tenPrinted'],
    ['visaLostOrStolen', 'visaCancelledOrRevoked'],
    ['refusedVisaOrAdmission', 'refusedVisaExplain'],
    ['immigrantPetitionFiled', 'immigrantPetitionExplain'],
  ],
  addressPhone: [
    ['homeStreetAddress1', 'homeStreetAddress2', 'homeCity', 'homeStateProvince', 'homePostalCode', 'homeCountry'],
    ['mailingSameAsHome'],
    ['primaryPhone', 'secondaryPhone', 'workPhone', 'hasOtherPhones'],
    ['email', 'hasOtherEmails'],
    ['hasSocialMedia', 'hasOtherWebPresence'],
  ],
  passport: [
    ['documentType', 'documentNumber', 'bookNumber'],
    ['issuingCountry', 'issuingCity', 'issuingState', 'issuanceDate', 'expirationDate'],
    ['wasLostOrStolen'],
  ],
  usContact: [['contactSurname', 'contactGivenNames', 'organizationName', 'relationship', 'address', 'phone']],
  familyInfo: [['hasImmediateRelativesInUS', 'hasOtherRelativesInUS']],
  presentWork: [
    ['occupation', 'employerOrSchoolName', 'startDate'],
    ['streetAddress1', 'streetAddress2', 'city', 'stateProvince', 'postalCode', 'country', 'phone'],
    ['monthlyIncome', 'duties'],
  ],
  previousWork: [['wasPreviouslyEmployed'], ['attendedSecondaryOrAbove']],
  additionalWork: [
    ['belongsToClanOrTribe', 'belongsToClanOrTribeExplain'],
    ['hasTraveledLast5Years'],
    ['hasOrgMembership', 'hasOrgMembershipExplain'],
    ['hasSpecializedSkills', 'hasSpecializedSkillsExplain'],
    ['hasMilitaryService', 'hasMilitaryServiceExplain'],
    ['hasParamilitaryInvolvement', 'hasParamilitaryInvolvementExplain'],
  ],
  companions: [['hasCompanions', 'travelingAsGroup']],
  sevisSchool: [['sevisId', 'schoolName', 'courseOfStudy', 'schoolAddress']],
}

/**
 * The next cluster of gaps to ask about together.
 *
 * Everything the documents already answered is absent from `gaps` by
 * construction - this only ever sees blanks - so an applicant who uploaded a
 * passport, an I-20 and an itinerary is never asked their passport number, and
 * the security pages, which default to No, never come up at all. What is left
 * is the handful the paperwork cannot know.
 */
export function nextBatch(gaps: Gap[], cap = 8): Gap[] {
  if (gaps.length === 0) return []
  const first = gaps[0]
  const sameSection = gaps.filter((g) => g.section === first.section)
  const clusters = ASK_CLUSTERS[first.section]

  if (clusters) {
    const cluster = clusters.find((c) => c.includes(first.field))
    if (cluster) {
      const batch = sameSection.filter((g) => cluster.includes(g.field))
      if (batch.length) return batch.slice(0, cap)
    }
  }

  // No cluster covers it - take a capped run, and never bundle a free-text
  // explanation with anything else: attached to three other fields it gets a
  // one-word answer.
  const batch: Gap[] = []
  for (const gap of sameSection) {
    if (gap.type === 'textarea' && batch.length > 0) break
    batch.push(gap)
    if (gap.type === 'textarea' || batch.length >= cap) break
  }
  return batch
}

/** A short digest of what is already answered, so the model never re-asks it. */
export function knownContext(data: Ds160Data, t: (key: string) => string, limit = 40): string {
  const lines: string[] = []
  for (const section of DS160_SECTIONS) {
    if (section.def.kind !== 'simple') continue
    const sectionData = (data[section.key] as Record<string, any>) || {}
    for (const group of section.def.groups) {
      for (const field of group.fields) {
        const value = sectionData[field.key]
        if (isEmpty(value) || typeof value !== 'string') continue
        // The pre-answered "No"s are noise here; they say nothing about who
        // this applicant is and there are dozens of them.
        if (PRE_ANSWERED_NO.has(section.key) && value === 'No') continue
        lines.push(`${fieldLabel(field, t)}: ${value}`)
        if (lines.length >= limit) return lines.join('\n')
      }
    }
  }
  return lines.join('\n')
}
