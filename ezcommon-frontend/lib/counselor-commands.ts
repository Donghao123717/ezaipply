/**
 * The slash-command palette behind the counselor's Quick Actions.
 *
 * Three suggested questions per specialist was a nudge, not a tool - a student
 * who did not know what to ask still did not know, and one who did had to type
 * the whole question. These are the questions worth asking often enough to
 * deserve a shortcut: typing "/" lists them, typing a few letters narrows them,
 * and Enter sends the full question rather than the shorthand.
 *
 * Each command carries the message that actually gets sent. The label is what
 * you scan; the prompt is what the counselor reads, written out in full because
 * a vague question gets a vague answer.
 */

export type CommandGroup = 'schools' | 'profile' | 'essays' | 'forms' | 'files'

export interface CounselorCommand {
  /** What the student types after "/". Kept short and in English on purpose:
   *  it is a keystroke, not prose, and it stays stable across languages. */
  id: string
  group: CommandGroup
  /** counselor.commands.<id>.label */
  labelKey: string
  /** counselor.commands.<id>.prompt - the message sent to the counselor. */
  promptKey: string
}

export const COMMAND_GROUPS: CommandGroup[] = ['schools', 'profile', 'essays', 'forms', 'files']

function cmd(id: string, group: CommandGroup): CounselorCommand {
  return {
    id,
    group,
    labelKey: `counselor.commands.${id}.label`,
    promptKey: `counselor.commands.${id}.prompt`,
  }
}

export const COUNSELOR_COMMANDS: CounselorCommand[] = [
  cmd('balance', 'schools'),
  cmd('add-school', 'schools'),
  cmd('cut-school', 'schools'),
  cmd('early', 'schools'),
  cmd('cost', 'schools'),
  cmd('major', 'schools'),

  cmd('gaps', 'profile'),
  cmd('activities', 'profile'),
  cmd('scores', 'profile'),
  cmd('next-term', 'profile'),
  cmd('recommenders', 'profile'),

  cmd('topic', 'essays'),
  cmd('outline', 'essays'),
  cmd('why-school', 'essays'),
  cmd('tighten', 'essays'),
  cmd('reuse', 'essays'),

  cmd('deadlines', 'forms'),
  cmd('this-week', 'forms'),
  cmd('unfinished', 'forms'),
  cmd('fee-waiver', 'forms'),
  cmd('ready', 'forms'),

  cmd('documents', 'files'),
  cmd('read-transcript', 'files'),
  cmd('case-summary', 'files'),
]

/**
 * Match on the typed id first, then on the translated label, so "/dead" finds
 * the deadlines command in English and 「截止」 finds it in Chinese.
 */
export function filterCommands(
  query: string,
  t: (key: string) => string,
): CounselorCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return COUNSELOR_COMMANDS
  const scored = COUNSELOR_COMMANDS.map((c) => {
    const id = c.id.toLowerCase()
    const label = t(c.labelKey).toLowerCase()
    if (id.startsWith(q)) return { c, rank: 0 }
    if (id.includes(q)) return { c, rank: 1 }
    if (label.includes(q)) return { c, rank: 2 }
    return { c, rank: -1 }
  })
  return scored
    .filter((s) => s.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((s) => s.c)
}
