import { computeProfileSectionsProgress } from '@/lib/profile-schema'
import { loadEssays, wordCount } from '@/lib/essay-store'
import { ESSAY_TASKS, essayTaskTitle, getSchoolEssayTasks } from '@/lib/essay-tasks'
import { loadColleges } from '@/lib/college-store'
import { computeApplicationProgress } from '@/lib/application-status'
import { loadForecast } from '@/lib/forecast-store'

export interface TrackerItem {
  label: string
  done: boolean
  href: string
}

export interface TrackerStage {
  key: string
  label: string
  href: string
  completed: number
  total: number
  items: TrackerItem[]
}

export interface ApplicationTracker {
  stages: TrackerStage[]
  percent: number
}

/**
 * Aggregates real progress from every feature's own localStorage-backed store
 * (profile, essays, colleges, forecast) - no fabricated numbers. `t` resolves
 * every static label (stage names, item labels) via lib/i18n/dictionary.ts
 * "counselor.tracker" / "writing.tasks"; college names and school-supplement
 * titles are user data and aren't translated.
 */
export function computeApplicationTracker(userId: string, t: (key: string) => string): ApplicationTracker {
  const profile = computeProfileSectionsProgress(userId)
  const profileStage: TrackerStage = {
    key: 'profile',
    label: t('counselor.tracker.stageProfile'),
    href: '/profile',
    completed: profile.completed,
    total: profile.total,
    items: profile.sections.map((s) => ({ label: t(s.labelKey), done: s.complete, href: '/profile' })),
  }

  const colleges = loadColleges(userId)
  const essays = loadEssays(userId)
  const essayTasks = [...ESSAY_TASKS, ...getSchoolEssayTasks(colleges, t)]
  const essayItems: TrackerItem[] = essayTasks.map((task) => ({
    label: essayTaskTitle(task, t),
    done: wordCount(essays[task.id]?.html || '') > 0,
    href: '/writing',
  }))
  const writingStage: TrackerStage = {
    key: 'writing',
    label: t('counselor.tracker.stageWriting'),
    href: '/writing',
    completed: essayItems.filter((i) => i.done).length,
    total: essayItems.length,
    items: essayItems,
  }

  const schoolItems: TrackerItem[] = colleges.map((college) => ({
    label: college.name,
    done: computeApplicationProgress(userId, college.id).status === 'complete',
    href: '/submit',
  }))
  const schoolsStage: TrackerStage = {
    key: 'schools',
    label: t('counselor.tracker.stageSchools'),
    href: '/colleges',
    completed: schoolItems.filter((i) => i.done).length,
    total: schoolItems.length,
    items: schoolItems,
  }

  const forecast = loadForecast(userId)
  const forecastItems: TrackerItem[] = [
    { label: t('counselor.tracker.forecastItem1'), done: colleges.length > 0, href: '/colleges' },
    { label: t('counselor.tracker.forecastItem2'), done: forecast !== null, href: '/forecast' },
    { label: t('counselor.tracker.forecastItem3'), done: schoolItems.some((i) => i.done), href: '/submit' },
  ]
  const forecastStage: TrackerStage = {
    key: 'forecast',
    label: t('counselor.tracker.stageForecast'),
    href: '/forecast',
    completed: forecastItems.filter((i) => i.done).length,
    total: forecastItems.length,
    items: forecastItems,
  }

  const stages = [profileStage, writingStage, schoolsStage, forecastStage]
  const totalCompleted = stages.reduce((sum, s) => sum + s.completed, 0)
  const totalItems = stages.reduce((sum, s) => sum + s.total, 0)
  const percent = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

  return { stages, percent }
}

/** The first not-yet-done item across all stages, in stage order - drives the "Your Next Step" card. */
export function findNextStep(tracker: ApplicationTracker): { stage: TrackerStage; item: TrackerItem } | null {
  for (const stage of tracker.stages) {
    const item = stage.items.find((i) => !i.done)
    if (item) return { stage, item }
  }
  return null
}
