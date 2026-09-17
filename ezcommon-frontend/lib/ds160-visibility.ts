import type { Ds160Data } from '@/lib/ds160-store'

/**
 * Which questions the form is actually asking, given what has been answered.
 *
 * The real DS-160 branches everywhere: a Yes opens a block, a No closes it, and
 * a question that is closed is not a question you failed to answer - it does
 * not exist for you. We had this in one place only, and only for the
 * conversation, so the form went on showing every field regardless. The result
 * was a page of "if yes, please explain" boxes under answers of No, and a
 * confirmation step counting them as blanks.
 *
 * One map, read by the form, the conversation and the review, so they cannot
 * disagree about what is being asked.
 */

interface Gate {
  section: string
  field: string
  equals: string[]
}

const FIELD_GATES: Record<string, Gate> = {}
const LIST_GATES: Record<string, Gate> = {}

function gateFields(section: string, parent: string, equals: string | string[], children: string[]) {
  const values = Array.isArray(equals) ? equals : [equals]
  for (const child of children) FIELD_GATES[`${section}.${child}`] = { section, field: parent, equals: values }
}

function gateList(section: string, parent: string, equals: string | string[], lists: string[]) {
  const values = Array.isArray(equals) ? equals : [equals]
  for (const list of lists) LIST_GATES[`${section}.${list}`] = { section, field: parent, equals: values }
}

/** "If yes, please explain" exists only because of the Yes above it. */
function gateExplains(section: string, pairs: [string, string][]) {
  for (const [parent, explain] of pairs) gateFields(section, parent, 'Yes', [explain])
}

// --- Personal ---------------------------------------------------------------
gateList('personal1', 'hasOtherNames', 'Yes', ['otherNames'])
gateList('personal1', 'hasOtherNationality', 'Yes', ['otherNationalities'])

// --- Travel -----------------------------------------------------------------
gateFields('travel', 'hasSpecificPlans', 'Yes', [
  'arrivalFlight',
  'arrivalCity',
  'departureDate',
  'departureFlight',
  'departureCity',
])
gateList('travel', 'hasSpecificPlans', 'Yes', ['locationsToVisit'])
gateFields('travel', 'hasSpecificPlans', 'No', ['intendedLengthOfStay', 'intendedLengthUnit'])
gateFields('travel', 'payer', ['OTHER PERSON'], [
  'payerSurnames',
  'payerGivenNames',
  'payerPhone',
  'payerEmail',
  'payerRelationship',
  'payerAddressSameAsHome',
])
gateFields('travel', 'payer', ['OTHER COMPANY/ORGANIZATION'], [
  'payerOrgName',
  'payerOrgPhone',
  'payerOrgRelationship',
])

// --- Travel companions ------------------------------------------------------
gateFields('companions', 'hasCompanions', 'Yes', ['travelingAsGroup'])
gateFields('companions', 'travelingAsGroup', 'Yes', ['groupName'])
gateList('companions', 'hasCompanions', 'Yes', ['people'])

// --- Previous US travel -----------------------------------------------------
// The licence question sits inside the "have you ever been in the U.S." block
// on the real form.
gateFields('previousTravel', 'hasBeenToUS', 'Yes', ['dateArrived', 'lengthOfStay', 'hasDriversLicense'])
gateList('previousTravel', 'hasBeenToUS', 'Yes', ['priorVisits'])
gateFields('previousTravel', 'hasPriorVisa', 'Yes', [
  'lastVisaDate',
  'visaNumber',
  'sameVisaType',
  'sameCountryAsBefore',
  'tenPrinted',
  'visaLostOrStolen',
  'visaCancelledOrRevoked',
])
gateExplains('previousTravel', [
  ['refusedVisaOrAdmission', 'refusedVisaExplain'],
  ['immigrantPetitionFiled', 'immigrantPetitionExplain'],
])

// --- Address and phone ------------------------------------------------------
gateFields('addressPhone', 'hasOtherPhones', 'Yes', ['additionalPhone'])
gateFields('addressPhone', 'hasOtherEmails', 'Yes', ['additionalEmail'])
gateFields('addressPhone', 'hasOtherWebPresence', 'Yes', ['additionalPlatform', 'additionalHandle'])
gateList('addressPhone', 'hasSocialMedia', 'Yes', ['socialMediaAccounts'])

// --- Family -----------------------------------------------------------------
// A parent's immigration status is meaningless unless they are in the US.
gateFields('familyInfo', 'fatherInUS', 'Yes', ['fatherStatus'])
gateFields('familyInfo', 'motherInUS', 'Yes', ['motherStatus'])

// --- Work, education, training ---------------------------------------------
gateList('previousWork', 'wasPreviouslyEmployed', 'Yes', ['jobs'])
gateList('previousWork', 'attendedSecondaryOrAbove', 'Yes', ['schools'])
gateExplains('additionalWork', [
  ['belongsToClanOrTribe', 'belongsToClanOrTribeExplain'],
  ['hasOrgMembership', 'hasOrgMembershipExplain'],
  ['hasSpecializedSkills', 'hasSpecializedSkillsExplain'],
  ['hasMilitaryService', 'hasMilitaryServiceExplain'],
  ['hasParamilitaryInvolvement', 'hasParamilitaryInvolvementExplain'],
])
gateList('additionalWork', 'hasTraveledLast5Years', 'Yes', ['countriesVisited'])

// --- Security and background ------------------------------------------------
// Thirty-five questions, each with an explanation that only exists on a Yes.
// Derived rather than listed: every explain field here is named after the
// question above it, so writing them out twice would only be a chance to get
// one wrong.
const SECURITY_EXPLAINS: Record<string, string[]> = {
  security1: ['communicableDisease', 'mentalOrPhysicalDisorder', 'drugAbuserOrAddict'],
  security2: [
    'arrestedOrConvicted', 'controlledSubstancesViolation', 'prostitution', 'moneyLaundering',
    'humanTraffickingCommitted', 'humanTraffickingAided', 'humanTraffickingFamilyBenefit',
  ],
  security3: [
    'espionageOrSabotage', 'terroristActivities', 'terroristFinancialSupport', 'terroristOrgMember',
    'terroristFamilyMember', 'genocide', 'torture', 'extrajudicialKillings', 'childSoldiers',
    'religiousFreedomViolations', 'forcedAbortionOrSterilization', 'coerciveOrganTransplant',
  ],
  security4: ['fraudOrMisrepresentation', 'removedOrDeported'],
  security5: ['withheldChildCustody', 'votedUnlawfully', 'renouncedCitizenshipForTax'],
}
for (const [section, questions] of Object.entries(SECURITY_EXPLAINS)) {
  gateExplains(section, questions.map((q) => [q, `${q}Explain`] as [string, string]))
}

/**
 * The payer's address has two ways in, which one parent field cannot express:
 * an organisation is always asked for it, a person only when their address
 * differs from the applicant's own.
 */
const PAYER_ADDRESS_FIELDS = new Set([
  'payerStreetAddress1',
  'payerStreetAddress2',
  'payerCity',
  'payerStateProvince',
  'payerPostalCode',
  'payerCountry',
])

function payerAddressAsked(travel: Record<string, any> | undefined): boolean {
  const payer = travel?.payer
  if (payer === 'OTHER COMPANY/ORGANIZATION') return true
  if (payer === 'OTHER PERSON') return travel?.payerAddressSameAsHome === 'No'
  return false
}

/** Is the form asking this field of this applicant? */
export function isFieldVisible(section: string, field: string, data: Ds160Data): boolean {
  if (section === 'travel' && PAYER_ADDRESS_FIELDS.has(field)) {
    return payerAddressAsked(data.travel as Record<string, any>)
  }
  const gate = FIELD_GATES[`${section}.${field}`]
  if (!gate) return true
  const parent = (data[gate.section] as Record<string, any> | undefined)?.[gate.field]
  return typeof parent === 'string' && gate.equals.includes(parent)
}

/** Is the form asking for this list from this applicant? */
export function isListVisible(section: string, nestedKey: string, data: Ds160Data): boolean {
  const gate = LIST_GATES[`${section}.${nestedKey}`]
  if (!gate) return true
  const parent = (data[gate.section] as Record<string, any> | undefined)?.[gate.field]
  return typeof parent === 'string' && gate.equals.includes(parent)
}

/** The question that opens this one, for explaining why it appeared. */
export function gateParent(section: string, field: string): Gate | undefined {
  return FIELD_GATES[`${section}.${field}`]
}
