export interface SchoolForecast {
  id: string
  chance: number
  materialStrength: number
  profileFit: number
  narrativeFit: number
  analysis: string
  recommendation: string
}

export interface ForecastRecord {
  generatedAt: string
  inputSignature: string
  schools: SchoolForecast[]
}

function forecastKey(userId: string) {
  return `aipply-forecast-${userId}`
}

export function loadForecast(userId: string): ForecastRecord | null {
  try {
    const raw = window.localStorage.getItem(forecastKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveForecast(userId: string, record: ForecastRecord) {
  window.localStorage.setItem(forecastKey(userId), JSON.stringify(record))
}

/** Cheap way to detect "your profile/list/essays changed since this forecast" without deep diffing. */
export function computeSignature(userId: string): string {
  try {
    const profile = window.localStorage.getItem(`aipply-profile-${userId}`) || ''
    const colleges = window.localStorage.getItem(`aipply-colleges-${userId}`) || ''
    const essays = window.localStorage.getItem(`aipply-essays-${userId}`) || ''
    return `${profile.length}:${colleges}:${essays.length}`
  } catch {
    return ''
  }
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours > 0) return `${hours}h ago`
  const minutes = Math.floor(diffMs / (1000 * 60))
  return minutes > 0 ? `${minutes}m ago` : 'just now'
}
