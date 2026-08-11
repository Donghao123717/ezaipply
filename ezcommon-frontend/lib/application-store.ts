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
  window.localStorage.setItem(applicationKey(userId, collegeId), JSON.stringify(answers))
}
