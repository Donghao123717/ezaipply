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

// A general-purpose set of essay prompt starters, in the same spirit as the
// broad topic categories most U.S. college applications ask about (identity,
// overcoming a setback, changing your mind, gratitude, growth, intellectual
// curiosity, or an open topic). Written independently, not quoted from any
// single application's official prompt text.
export const ESSAY_PROMPTS: { id: string; text: string }[] = [
  {
    id: 'identity',
    text: 'Tell us about a part of your identity, background, or a passion that has shaped who you are - something your application would feel incomplete without.',
  },
  {
    id: 'setback',
    text: 'Describe a real setback or failure you experienced. What happened, how did you respond, and what changed in how you think or act because of it?',
  },
  {
    id: 'changed-mind',
    text: 'Write about a moment you changed your mind about something you used to believe strongly. What caused the shift, and what did it teach you?',
  },
  {
    id: 'gratitude',
    text: 'Describe an act of kindness or generosity from someone else that caught you off guard. How did it change the way you show up for others?',
  },
  {
    id: 'growth',
    text: 'Tell the story of a moment or achievement that pushed you to see yourself, or the people around you, differently than before.',
  },
  {
    id: 'curiosity',
    text: 'What subject, question, or hobby pulls you in so completely that you lose track of time? Walk us through why, and where that curiosity has taken you.',
  },
  {
    id: 'open-topic',
    text: 'Write about whatever matters most to you right now. You can reuse a draft you already have or start something new.',
  },
]
