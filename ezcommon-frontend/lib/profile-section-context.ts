/**
 * One profile section, flattened into readable lines for a prompt.
 *
 * The recommender needs the activities and honours as prose, not as the nested
 * objects the profile stores them in - and it needs them without the rest of
 * the profile, so the model is rating the record rather than re-reading the
 * GPA it was already given as a number.
 */
export function profileSection(userId: string, sectionKey: string): string {
  try {
    const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
    if (!raw) return ''
    const value = (JSON.parse(raw) as Record<string, any>)[sectionKey]
    if (!Array.isArray(value)) return ''
    return value
      .map((item) =>
        Object.entries(item)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
      )
      .filter(Boolean)
      .join('\n')
  } catch {
    return ''
  }
}
