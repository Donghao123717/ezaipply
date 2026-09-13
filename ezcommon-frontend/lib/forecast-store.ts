import { queueUserStateSync } from '@/lib/user-state-sync'

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

/** A past refresh, kept so the student can see which way their odds are moving. */
export interface ForecastSnapshot {
  generatedAt: string
  portfolioChance: number
  schools: { id: string; chance: number }[]
}

interface StoredForecast {
  record: ForecastRecord | null
  history: ForecastSnapshot[]
}

/** Enough to show a trend without letting one user's key grow forever. */
const MAX_HISTORY = 12

function forecastKey(userId: string) {
  return `aipply-forecast-${userId}`
}

function readStored(userId: string): StoredForecast {
  try {
    const raw = window.localStorage.getItem(forecastKey(userId))
    if (!raw) return { record: null, history: [] }
    const parsed = JSON.parse(raw)
    // Forecasts saved before history existed are a bare record.
    if (parsed && Array.isArray(parsed.schools)) {
      return { record: parsed as ForecastRecord, history: [] }
    }
    return {
      record: parsed?.record ?? null,
      history: Array.isArray(parsed?.history) ? parsed.history : [],
    }
  } catch {
    return { record: null, history: [] }
  }
}

export function loadForecast(userId: string): ForecastRecord | null {
  return readStored(userId).record
}

export function loadForecastHistory(userId: string): ForecastSnapshot[] {
  return readStored(userId).history
}

export function saveForecast(userId: string, record: ForecastRecord, portfolioChance: number) {
  const { history } = readStored(userId)
  const snapshot: ForecastSnapshot = {
    generatedAt: record.generatedAt,
    portfolioChance,
    schools: record.schools.map((s) => ({ id: s.id, chance: s.chance })),
  }
  const next: StoredForecast = {
    record,
    history: [...history, snapshot].slice(-MAX_HISTORY),
  }
  const key = forecastKey(userId)
  const value = JSON.stringify(next)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}

/** The chance for each school at the previous refresh, for the delta column. */
export function previousChances(history: ForecastSnapshot[]): Map<string, number> {
  const previous = history.length >= 2 ? history[history.length - 2] : null
  return new Map(previous ? previous.schools.map((s) => [s.id, s.chance]) : [])
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
