import type { VisaType } from '@/lib/visa-chat-store'

/**
 * What we ask an applicant to hand over, and what each document is for.
 *
 * The order is the order a person can actually produce them in: what is in
 * their pocket, then what the consulate asks about them, then what is specific
 * to the visa they are applying for. Each one earns its place by filling part
 * of the DS-160 or by being a document they are asked to bring - nothing is
 * collected because it might be useful.
 */

export type VisaDocKind =
  | 'passport'
  | 'nationalId'
  | 'photo'
  | 'previousVisa'
  | 'familyInfo'
  | 'funds'
  | 'sponsorLetter'
  | 'employment'
  | 'travelPlan'
  | 'hotelBooking'
  | 'i20'
  | 'admissionLetter'
  | 'sevisFeeReceipt'
  | 'transcript'
  | 'h1bApproval'
  | 'jobOffer'
  | 'employerLetter'

export interface VisaDocSpec {
  kind: VisaDocKind
  /** Dictionary path for the name and the one-line explanation. */
  labelKey: string
  hintKey: string
  /** Every applicant is asked for this one. */
  required: boolean
  /** Reading this one fills part of the DS-160. */
  extracts: boolean
}

function doc(kind: VisaDocKind, required: boolean, extracts: boolean): VisaDocSpec {
  return {
    kind,
    labelKey: `visaDocs.kinds.${kind}.label`,
    hintKey: `visaDocs.kinds.${kind}.hint`,
    required,
    extracts,
  }
}

/** Asked of everyone, whatever they are applying for. */
const SHARED: VisaDocSpec[] = [
  doc('passport', true, true),
  doc('nationalId', true, true),
  doc('photo', true, false),
  doc('previousVisa', false, true),
  doc('familyInfo', false, true),
  doc('funds', true, true),
  doc('sponsorLetter', false, true),
  doc('employment', false, true),
]

/** What each visa class asks for on top of that. */
const BY_TYPE: Record<VisaType, VisaDocSpec[]> = {
  B1B2: [doc('travelPlan', true, true), doc('hotelBooking', false, true)],
  F1: [
    doc('i20', true, true),
    doc('admissionLetter', false, true),
    doc('sevisFeeReceipt', false, false),
    doc('transcript', false, false),
  ],
  H1B: [doc('h1bApproval', true, true), doc('jobOffer', true, true), doc('employerLetter', false, true)],
}

export function documentsFor(visaType: VisaType): VisaDocSpec[] {
  return [...SHARED, ...(BY_TYPE[visaType] || [])]
}

/**
 * The document type is carried in the stored filename rather than in a
 * database row: a bare "scan.pdf" in a bucket tells nobody whether it is a
 * passport or a bank statement, and the applicant's own files outlive whatever
 * we remember about them.
 */
export function storedName(kind: VisaDocKind, filename: string): string {
  return `${kind}__${filename}`
}

export function kindOf(storedFilename: string): VisaDocKind | null {
  const [prefix] = storedFilename.split('__')
  return prefix && prefix !== storedFilename ? (prefix as VisaDocKind) : null
}

export function displayName(storedFilename: string): string {
  const index = storedFilename.indexOf('__')
  return index >= 0 ? storedFilename.slice(index + 2) : storedFilename
}
