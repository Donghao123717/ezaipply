import { DS160_SECTIONS, type FieldDef, type Ds160SectionMeta } from '@/lib/ds160-schema'
import { fieldLabel } from '@/lib/profile-schema'
import type { Ds160Data } from '@/lib/ds160-store'

/**
 * Which DS-160 fields are still unanswered, in the order the form asks them.
 *
 * The model does not get to decide what to ask next. A model walking its own
 * way through two hundred and thirty-one fields wanders, asks the same thing
 * twice, and quietly skips the ones that decide the case; the form's own order
 * is already a considered sequence and it is free to follow. So this picks the
 * next few fields deterministically and the model's job is only to put them
 * into a sentence and read the reply back.
 */

export interface Gap {
  section: string
  field: string
  label: string
  type: string
  options: string[]
  required: boolean
  help: string
}

/** Pages that are not questions to ask - they are ours, or they are a checklist. */
const SKIP_SECTIONS = new Set(['setup', 'photo'])

/**
 * Security questions and a handful of others are pre-answered "No" on load, and
 * asking thirty-five of them out loud would bury the ten that matter. They stay
 * in the form for review; the conversation leaves them alone unless one is Yes.
 */
const SKIP_UNLESS_YES = new Set(['security1', 'security2', 'security3', 'security4', 'security5'])

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function gapFrom(sectionKey: string, field: FieldDef, t: (key: string) => string): Gap {
  return {
    section: sectionKey,
    field: field.key,
    label: fieldLabel(field, t),
    type: field.type || 'text',
    options: field.options || [],
    required: !!field.required,
    help: field.help || '',
  }
}

/** Every unanswered field, form order, skipping the pages above. */
export function findGaps(data: Ds160Data, t: (key: string) => string, visibleSections?: Ds160SectionMeta[]): Gap[] {
  const sections = visibleSections || DS160_SECTIONS
  const gaps: Gap[] = []

  for (const section of sections) {
    if (SKIP_SECTIONS.has(section.key)) continue
    if (section.def.kind !== 'simple') continue
    const sectionData = (data[section.key] as Record<string, any>) || {}

    for (const group of section.def.groups) {
      for (const field of group.fields) {
        if (!isEmpty(sectionData[field.key])) continue
        if (SKIP_UNLESS_YES.has(section.key)) continue
        // An explanation only exists because of a Yes above it. Asking "please
        // explain" of someone who answered No is asking about nothing.
        if (/explain|explanation/i.test(field.key) && !hasYesInSection(sectionData)) continue
        gaps.push(gapFrom(section.key, field, t))
      }
    }
  }
  return gaps
}

function hasYesInSection(sectionData: Record<string, any>): boolean {
  return Object.values(sectionData).some((v) => typeof v === 'string' && v === 'Yes')
}

/**
 * The next few gaps to ask about together.
 *
 * Grouped by the page they live on and capped, because "when do you arrive,
 * when do you leave, and where are you staying?" is one question a person
 * answers in one breath, while six unrelated fields in one question is an
 * interrogation nobody finishes.
 */
export function nextBatch(gaps: Gap[], size = 3): Gap[] {
  if (gaps.length === 0) return []
  const first = gaps[0]
  const batch: Gap[] = []
  for (const gap of gaps) {
    if (gap.section !== first.section) break
    // A free-text explanation deserves its own question - bundled with three
    // other fields it gets a one-word answer.
    if (gap.type === 'textarea' && batch.length > 0) break
    batch.push(gap)
    if (gap.type === 'textarea' || batch.length >= size) break
  }
  return batch
}

/** A short digest of what is already answered, so the model never re-asks it. */
export function knownContext(data: Ds160Data, t: (key: string) => string, limit = 40): string {
  const lines: string[] = []
  for (const section of DS160_SECTIONS) {
    if (section.def.kind !== 'simple') continue
    const sectionData = (data[section.key] as Record<string, any>) || {}
    for (const group of section.def.groups) {
      for (const field of group.fields) {
        const value = sectionData[field.key]
        if (isEmpty(value) || typeof value !== 'string') continue
        // The pre-answered "No"s are noise here; they say nothing about who
        // this applicant is and there are dozens of them.
        if (SKIP_UNLESS_YES.has(section.key) && value === 'No') continue
        lines.push(`${fieldLabel(field, t)}: ${value}`)
        if (lines.length >= limit) return lines.join('\n')
      }
    }
  }
  return lines.join('\n')
}
