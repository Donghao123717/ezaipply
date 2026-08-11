import { APPLICATION_PAGES } from '@/lib/application-schema'
import { loadApplication } from '@/lib/application-store'
import { loadEssays, wordCount } from '@/lib/essay-store'

export type ApplicationStatus = 'not_started' | 'getting_started' | 'in_progress' | 'almost_done' | 'complete'

export interface ApplicationProgress {
  status: ApplicationStatus
  requiredAnswered: number
  requiredTotal: number
  optionalTotal: number
  percent: number
}

function requiredFieldKeys(): string[] {
  const keys: string[] = []
  for (const page of APPLICATION_PAGES) {
    if (page.kind !== 'fields' || !page.groups) continue
    for (const group of page.groups) {
      for (const field of group.fields) {
        if (field.required) keys.push(field.key)
      }
    }
  }
  return keys
}

function optionalFieldCount(): number {
  let count = 0
  for (const page of APPLICATION_PAGES) {
    if (page.kind !== 'fields' || !page.groups) continue
    for (const group of page.groups) {
      count += group.fields.filter((f) => !f.required).length
    }
  }
  return count
}

export function computeApplicationProgress(userId: string, collegeId: string): ApplicationProgress {
  const answers = loadApplication(userId, collegeId)
  const required = requiredFieldKeys()
  const requiredAnswered = required.filter((k) => answers[k]?.trim()).length
  const requiredTotal = required.length + 1 // +1 for the required Writing essay
  const optionalTotal = optionalFieldCount()

  const essays = loadEssays(userId)
  const essayRecord = essays[`school-${collegeId}`]
  const essayDone = essayRecord ? wordCount(essayRecord.html) > 0 : false

  const totalRequiredAnswered = requiredAnswered + (essayDone ? 1 : 0)
  const percent = requiredTotal > 0 ? Math.round((totalRequiredAnswered / requiredTotal) * 100) : 0

  let status: ApplicationStatus = 'not_started'
  if (percent === 0) status = 'not_started'
  else if (percent < 30) status = 'getting_started'
  else if (percent < 75) status = 'in_progress'
  else if (percent < 100) status = 'almost_done'
  else status = 'complete'

  return { status, requiredAnswered: totalRequiredAnswered, requiredTotal, optionalTotal, percent }
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  not_started: 'Not started',
  getting_started: 'Getting started',
  in_progress: 'In Progress',
  almost_done: 'Almost done',
  complete: 'Complete',
}

/** Dictionary key for each status, resolved via useT() - see lib/i18n/dictionary.ts "common.status". */
export const STATUS_LABEL_KEY: Record<ApplicationStatus, string> = {
  not_started: 'common.status.notStarted',
  getting_started: 'common.status.gettingStarted',
  in_progress: 'common.status.inProgress',
  almost_done: 'common.status.almostDone',
  complete: 'common.status.complete',
}
