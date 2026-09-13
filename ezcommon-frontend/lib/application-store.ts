import { queueUserStateSync } from '@/lib/user-state-sync'

export type ApplicationAnswers = Record<string, string>

function applicationKey(userId: string, collegeId: string) {
  return `aipply-application-${userId}-${collegeId}`
}

export function loadApplication(userId: string, collegeId: string): ApplicationAnswers {
  try {
    const raw = window.localStorage.getItem(applicationKey(userId, collegeId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveApplication(userId: string, collegeId: string, answers: ApplicationAnswers) {
  const key = applicationKey(userId, collegeId)
  const value = JSON.stringify(answers)
  window.localStorage.setItem(key, value)
  queueUserStateSync(key, value)
}
