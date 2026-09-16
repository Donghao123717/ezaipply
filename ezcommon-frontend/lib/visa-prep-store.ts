import { queueUserStateSync } from '@/lib/user-state-sync'

export const REQUIRED_DOCUMENTS = [
  'passport',
  'i20',
  'ds160Confirmation',
  'sevisFeeReceipt',
  'visaFeeReceipt',
  'photo',
  'academicTranscripts',
  'financialEvidence',
  'admissionLetter',
] as const

export type RequiredDocumentKey = (typeof REQUIRED_DOCUMENTS)[number]

/** One uploaded visa document, as returned by the upload endpoint. */
export interface VisaDocFile {
  filename: string
  size: number
  url?: string
  uploadedAt: string
}

/**
 * How the applicant gets their passport back afterwards. Chosen when booking,
 * asked at the window, and the one part of the appointment we can usefully
 * hold for them - the booking itself is theirs to make.
 */
export type PassportReturn = '' | 'pickup' | 'courier'

export interface VisaPrepData {
  sevisFeepaid: boolean
  ds160ConfirmationBarcode: string
  consulate: string
  appointmentDate: string
  /** Local time of the interview, as the confirmation gives it. */
  appointmentTime: string
  /** Recorded once they have submitted on ceac.state.gov - we never submit. */
  ds160SubmittedAt: string
  passportReturn: PassportReturn
  /** The pickup centre, or the address the courier delivers to. */
  returnAddress: string
  documentsChecked: Record<string, boolean>
  /**
   * Files held against each checklist item. The upload endpoint stores them
   * all under one `visa` section in S3; this is what remembers which of them
   * is the I-20 and which is the bank statement, so each row can show its own.
   */
  documentFiles?: Partial<Record<RequiredDocumentKey, VisaDocFile[]>>
}


const DEFAULT_DATA: VisaPrepData = {
  sevisFeepaid: false,
  ds160ConfirmationBarcode: '',
  consulate: '',
  appointmentDate: '',
  appointmentTime: '',
  ds160SubmittedAt: '',
  passportReturn: '',
  returnAddress: '',
  documentsChecked: {},
  documentFiles: {},
}

function visaPrepKey(userId: string) {
  return `aipply-visa-prep-${userId}`
}

export function loadVisaPrep(userId: string): VisaPrepData {
  try {
    const raw = window.localStorage.getItem(visaPrepKey(userId))
    return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : DEFAULT_DATA
  } catch {
    return DEFAULT_DATA
  }
}

export function saveVisaPrep(userId: string, data: VisaPrepData) {
  const key = visaPrepKey(userId)
  const value = JSON.stringify(data)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
