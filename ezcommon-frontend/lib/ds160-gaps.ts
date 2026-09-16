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
  /** The form offers a "Does Not Apply" / "Do Not Know" box for this one. */
  not_applicable: string
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
const DEPENDS_ON: Record<string, { section: string; field: string; equals: string[] }> = {}

function dependOn(section: string, parent: string, equals: string | string[], children: string[]) {
  const values = Array.isArray(equals) ? equals : [equals]
  for (const child of children) {
    DEPENDS_ON[`${section}.${child}`] = { section, field: parent, equals: values }
  }
}

// Read off the real form, page by page, with each Yes expanded.
//
// Travel: with no specific plans made, the form drops the itinerary and asks
// only for an intended date and length of stay. It still asks where you will
// stay and who is paying - those are not part of the itinerary.
dependOn('travel', 'hasSpecificPlans', 'Yes', [
  'arrivalFlight',
  'arrivalCity',
  'departureDate',
  'departureFlight',
  'departureCity',
])
// Previous travel: the licence question sits inside the "have you ever been in
// the U.S." block on the real form - it is not asked of someone who has never
// been.
dependOn('previousTravel', 'hasBeenToUS', 'Yes', ['dateArrived', 'lengthOfStay', 'hasDriversLicense'])
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
// Address and phone: each "have you used any others in the last five years"
// opens its own list, and nothing below it is asked when the answer is No.
dependOn('addressPhone', 'hasOtherPhones', 'Yes', ['additionalPhone'])
dependOn('addressPhone', 'hasOtherEmails', 'Yes', ['additionalEmail'])
dependOn('addressPhone', 'hasOtherWebPresence', 'Yes', ['additionalPlatform', 'additionalHandle'])

// Who is paying. Three of the five answers open nothing at all - an applicant
// paying their own way, or being sent by their employer, is asked no follow-up
// whatsoever, and asking anyway was making the form feel like it had not
// listened.
const PAYER_PERSON = ['OTHER PERSON']
const PAYER_ORG = ['OTHER COMPANY/ORGANIZATION']
dependOn('travel', 'payer', PAYER_PERSON, [
  'payerSurnames',
  'payerGivenNames',
  'payerPhone',
  'payerEmail',
  'payerRelationship',
  'payerAddressSameAsHome',
])
dependOn('travel', 'payer', PAYER_ORG, ['payerOrgName', 'payerOrgPhone', 'payerOrgRelationship'])
// The itinerary's mirror image: an intended length of stay is what the form
// asks for instead, when no plans have been made.
dependOn('travel', 'hasSpecificPlans', 'No', ['intendedLengthOfStay', 'intendedLengthUnit'])
// A parent's immigration status is only asked once they are said to be in the
// US - it is meaningless otherwise.
dependOn('familyInfo', 'fatherInUS', 'Yes', ['fatherStatus'])
dependOn('familyInfo', 'motherInUS', 'Yes', ['motherStatus'])

const OPTIONAL_LABEL = /line 2|if known|optional|第二行|选填/i

/**
 * The payer's address, which has two ways in: an organisation is always asked
 * for it, a person only when their address differs from the applicant's own.
 * One parent field cannot express that, so it gets its own test.
 */
const PAYER_ADDRESS_FIELDS = [
  'payerStreetAddress1',
  'payerStreetAddress2',
  'payerCity',
  'payerStateProvince',
  'payerPostalCode',
  'payerCountry',
]

function payerAddressAsked(travel: Record<string, any> | undefined): boolean {
  const payer = travel?.payer
  if (payer === 'OTHER COMPANY/ORGANIZATION') return true
  if (payer === 'OTHER PERSON') return travel?.payerAddressSameAsHome === 'No'
  return false
}

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
    not_applicable: field.notApplicable || '',
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
        if (section.key === 'travel' && PAYER_ADDRESS_FIELDS.includes(field.key)) {
          if (!payerAddressAsked(data.travel as Record<string, any>)) continue
        }
        const gate = DEPENDS_ON[`${section.key}.${field.key}`]
        if (gate) {
          const parent = (data[gate.section] as Record<string, any>)?.[gate.field]
          if (typeof parent !== 'string' || !gate.equals.includes(parent)) continue
        }
        // The form marks some fields optional in their own label - "Street
        // Address (Line 2) *Optional*", "Arrival Flight (if known)". Asking
        // for them out loud spends a turn on something the applicant can
        // leave blank, and there are enough of them to notice.
        if (!field.required && OPTIONAL_LABEL.test(fieldLabel(field, t))) continue
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
 * What to ask next, and whether this is a first pass or the sweep.
 *
 * A question the applicant could not answer is not dropped - it is set aside
 * until the rest of its page is done, then asked once more, this time asking
 * what is in the way. Somebody who does not have their passport to hand at
 * nine in the evening is not refusing to answer, and stopping the whole form
 * on them is how a form gets abandoned. Somebody who has no US contact at all
 * needs a different answer, and the only way to tell the two apart is to ask.
 *
 * After the sweep the page is left alone and the blanks are carried to the
 * confirmation step, where they are named as blocking submission.
 */
export interface Batch {
  gaps: Gap[]
  /** Second time of asking: find out what is in the way. */
  sweep: boolean
  /** The page these belong to, so the caller can mark it swept. */
  section: string
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
 */
export function nextBatch(
  gaps: Gap[],
  cap = 8,
  deferred: Set<string> = new Set(),
  swept: Set<string> = new Set(),
): Batch {
  const id = (g: Gap) => `${g.section}.${g.field}`
  if (gaps.length === 0) return { gaps: [], sweep: false, section: '' }

  // Page order is the form's order. Work the current page to the end before
  // moving on, so the sweep happens while the page is still fresh.
  const order: string[] = []
  for (const gap of gaps) if (!order.includes(gap.section)) order.push(gap.section)

  for (const section of order) {
    const here = gaps.filter((g) => g.section === section)
    const fresh = here.filter((g) => !deferred.has(id(g)))
    if (fresh.length) return { gaps: clusterFrom(fresh, section, cap), sweep: false, section }

    const setAside = here.filter((g) => deferred.has(id(g)))
    if (setAside.length && !swept.has(section)) {
      return { gaps: setAside.slice(0, cap), sweep: true, section }
    }
  }
  return { gaps: [], sweep: false, section: '' }
}

function clusterFrom(gaps: Gap[], section: string, cap: number): Gap[] {
  const first = gaps[0]
  const clusters = ASK_CLUSTERS[section]
  if (clusters) {
    const cluster = clusters.find((c) => c.includes(first.field))
    if (cluster) {
      const batch = gaps.filter((g) => cluster.includes(g.field))
      if (batch.length) return batch.slice(0, cap)
    }
  }
  // No cluster covers it - take a capped run, and never bundle a free-text
  // explanation with anything else: attached to three other fields it gets a
  // one-word answer.
  const batch: Gap[] = []
  for (const gap of gaps) {
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
