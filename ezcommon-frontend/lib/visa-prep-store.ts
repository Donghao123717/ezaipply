export interface VisaPrepData {
  sevisFeepaid: boolean
  ds160ConfirmationBarcode: string
  consulate: string
  appointmentDate: string
  documentsChecked: Record<string, boolean>
}

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

const DEFAULT_DATA: VisaPrepData = {
  sevisFeepaid: false,
  ds160ConfirmationBarcode: '',
  consulate: '',
  appointmentDate: '',
  documentsChecked: {},
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
  window.localStorage.setItem(visaPrepKey(userId), JSON.stringify(data))
}
