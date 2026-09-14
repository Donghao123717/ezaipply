import { SCHOOL_ADMISSIONS_DATA } from '@/lib/school-admissions-data'

export interface EssayTask {
  id: string
  /** Dictionary key for static task titles - resolved via useT(). Dynamic (per-school) tasks use `title` instead. */
  titleKey?: string
  title?: string
  group: 'main' | 'school'
  school?: string
  wordLimit: number
  promptRequired?: boolean
  /** The real supplement prompt text, when sourced from school-admissions-data.ts - shown above the editor instead of a generic placeholder. */
  prompt?: string
}

export function essayTaskTitle(task: EssayTask, t: (key: string) => string): string {
  return task.titleKey ? t(task.titleKey) : task.title || ''
}

// Main Essays only. School-specific supplemental essays are generated per
// student from the colleges they've actually saved on the Colleges page
// (see getSchoolEssayTasks below) - there is nothing to show here until a
// student adds at least one school.
export const ESSAY_TASKS: EssayTask[] = [
  { id: 'personal-essay', titleKey: 'writing.tasks.personalEssay', group: 'main', wordLimit: 650, promptRequired: true },
  { id: 'short-answer-1', titleKey: 'writing.tasks.whyThisSchool', group: 'main', wordLimit: 250 },
  { id: 'short-answer-2', titleKey: 'writing.tasks.communityContribution', group: 'main', wordLimit: 250 },
]

/**
 * Generates one supplemental-essay task per real prompt for a saved college
 * (see lib/school-admissions-data.ts, researched for the US News Top 50).
 * Real Common App supplements differ school to school (some ask one short
 * question, others ask three) - schools outside that researched set fall
 * back to a single generic supplemental slot as a placeholder.
 */
export function getSchoolEssayTasks(colleges: { id: string; name: string }[], t: (key: string) => string): EssayTask[] {
  return colleges.flatMap((college) => {
    const admissions = SCHOOL_ADMISSIONS_DATA[college.name]
    if (admissions && admissions.essaySupplements.length > 0) {
      return admissions.essaySupplements.map((supp, i) => ({
        id: `school-${college.id}-${i}`,
        title: `${college.name} · ${t('writing.tasks.supplemental')} ${i + 1}`,
        group: 'school' as const,
        school: college.name,
        wordLimit: supp.wordLimit,
        prompt: supp.prompt,
      }))
    }
    return [
      {
        id: `school-${college.id}-0`,
        title: `${college.name} · ${t('writing.tasks.supplemental')}`,
        group: 'school' as const,
        school: college.name,
        wordLimit: 400,
      },
    ]
  })
}

/**
 * The Common App first-year personal essay prompts, 2026-27, quoted verbatim
 * from commonapp.org/apply/essay-prompts. A student drafting here is drafting
 * the answer they will actually submit, so a paraphrase is worse than useless:
 * prompt 4 asks specifically about gratitude someone else prompted in you, and
 * prompt 5 about a realisation that led to growth - answer a loose restatement
 * of either and you have answered a question nobody asked.
 *
 * Applicants may respond to one. The Common App limit is 650 words
 * (250 minimum). Re-verify each cycle: these change.
 *
 * Ids are stable storage keys - a student's saved selection is keyed by them,
 * so map new wording onto the existing id rather than renaming.
 */
export const COMMON_APP_PROMPT_CYCLE = '2026-27'
export const COMMON_APP_PROMPT_SOURCE = 'commonapp.org/apply/essay-prompts'

export const ESSAY_PROMPTS: { id: string; text: string }[] = [
  {
    id: 'identity',
    text: 'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
  },
  {
    id: 'setback',
    text: 'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?',
  },
  {
    id: 'changed-mind',
    text: 'Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?',
  },
  {
    id: 'gratitude',
    text: 'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?',
  },
  {
    id: 'growth',
    text: 'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.',
  },
  {
    id: 'curiosity',
    text: 'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?',
  },
  {
    id: 'open-topic',
    text: "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
  },
]
