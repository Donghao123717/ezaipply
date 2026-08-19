import { loadEssays } from '@/lib/essay-store'
import { ESSAY_TASKS, getSchoolEssayTasks, essayTaskTitle } from '@/lib/essay-tasks'
import { loadColleges } from '@/lib/college-store'
import { loadCounselorChatUpdatedAt, type CounselorTab } from '@/lib/counselor-chat'

const COUNSELOR_TABS: CounselorTab[] = ['team', 'strategist', 'essay', 'coordinator']

export interface RecentActivityItem {
  key: string
  type: 'writing' | 'counselor' | 'colleges'
  label: string
  timestamp: string
  href: string
}

/**
 * Derives a real "recent work" feed from each feature's own already-persisted
 * timestamps (essay updatedAt, college addedAt, counselor chat updatedAt)
 * rather than a separate activity log - so it can't drift out of sync with
 * what actually happened.
 */
export function computeRecentActivity(userId: string, t: (key: string) => string, limit = 5): RecentActivityItem[] {
  const items: RecentActivityItem[] = []

  const colleges = loadColleges(userId)
  const essays = loadEssays(userId)
  const allEssayTasks = [...ESSAY_TASKS, ...getSchoolEssayTasks(colleges, t)]
  for (const task of allEssayTasks) {
    const record = essays[task.id]
    if (!record?.html || !record.updatedAt) continue
    items.push({
      key: `writing-${task.id}`,
      type: 'writing',
      label: essayTaskTitle(task, t),
      timestamp: record.updatedAt,
      href: '/writing',
    })
  }

  for (const college of colleges) {
    if (!college.addedAt) continue
    items.push({
      key: `colleges-${college.id}`,
      type: 'colleges',
      label: college.name,
      timestamp: college.addedAt,
      href: `/colleges/${college.id}`,
    })
  }

  for (const tab of COUNSELOR_TABS) {
    const updatedAt = loadCounselorChatUpdatedAt(userId, tab)
    if (!updatedAt) continue
    items.push({
      key: `counselor-${tab}`,
      type: 'counselor',
      label: t(`counselor.personas.${tab}.navLabel`),
      timestamp: updatedAt,
      href: '/counselor',
    })
  }

  return items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit)
}
