import { queueUserStateSync } from '@/lib/user-state-sync'

/**
 * What every applicant carries to the window regardless of visa class.
 *
 * The rest of the checklist comes from `documentsFor(visaType)` - the same list
 * the intake collects against - because a B1/B2 applicant being told to bring
 * an I-20 is the kind of thing that makes people distrust the whole checklist.
 * These three are the ones that are not documents about the applicant but
 * about the application itself, so they belong to no visa class in particular.
 */
export const APPOINTMENT_DOCUMENTS = ['ds160Confirmation', 'visaFeeReceipt', 'appointmentLetter'] as const

export type AppointmentDocumentKey = (typeof APPOINTMENT_DOCUMENTS)[number]
/** Either an appointment document or one of the per-visa-type kinds. */
export type RequiredDocumentKey = string

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
