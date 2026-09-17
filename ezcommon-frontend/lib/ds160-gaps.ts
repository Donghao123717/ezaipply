import { DS160_SECTIONS, type FieldDef, type Ds160SectionMeta } from '@/lib/ds160-schema'
import { fieldLabel } from '@/lib/profile-schema'
import type { Ds160Data } from '@/lib/ds160-store'
import { isFieldVisible, isListVisible } from '@/lib/ds160-visibility'

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
  /**
   * The repeatable this question fills, when it is a list rather than a box -
   * "which languages do you speak?", "which countries have you visited?".
   * These were invisible to the conversation: it only ever walked the flat
   * fields, so a page whose real content is two lists was reported complete
   * while both lists sat empty.
   */
  nestedKey?: string
  field: string
  label: string
  type: string
  options: string[]
  required: boolean
  help: string
  /** The form offers a "Does Not Apply" / "Do Not Know" box for this one. */
  not_applicable: string
  /** Same as nestedKey, in the shape the API expects. */
  nested_key?: string
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

    // Lists first within their page, because "which languages do you speak?"
    // is the page's actual question and the Yes/No answers around it are
    // already settled.
    for (const nested of section.def.nestedRepeatables || []) {
      // Only single-value lists can be asked conversationally - a list of
      // previous employers needs the form, not a sentence.
      if (nested.fields.length !== 1) continue
      if (!isListVisible(section.key, nested.key, data)) continue
      const existing = sectionData[nested.key]
      if (Array.isArray(existing) && existing.length > 0) continue
      const field = nested.fields[0]
      gaps.push({
        ...gapFrom(section.key, field, t),
        nestedKey: nested.key,
        // The server reads snake_case, matching the rest of that API.
        nested_key: nested.key,
        label: t(nested.labelKey),
      } as Gap)
    }

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
        // A question the form is not asking this applicant is not a gap in
        // their application - read from the same map the form renders by, so
        // the two can never disagree about what is being asked.
        if (!isFieldVisible(section.key, field.key, data)) continue
        // The form marks some fields optional in their own label - "Street
        // Address (Line 2) *Optional*", "Arrival Flight (if known)". Asking
        // for them out loud spends a turn on something the applicant can
        // leave blank, and there are enough of them to notice.
        if (!field.required && OPTIONAL_LABEL.test(fieldLabel(field, t))) continue
        gaps.push(gapFrom(section.key, field, t))
      }
    }
  }
  return gaps
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
  if (first.nestedKey) return [first]
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
    // A list question asks for several answers at once ("English and Mandarin")
    // and needs the whole turn to itself.
    if ((gap.type === 'textarea' || gap.nestedKey) && batch.length > 0) break
    batch.push(gap)
    if (gap.type === 'textarea' || gap.nestedKey || batch.length >= cap) break
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
