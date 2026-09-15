/**
 * Turn an error body from the backend into something a person can read.
 *
 * FastAPI reports a failed request in two quite different shapes. A raised
 * HTTPException gives `detail` as a string, which is fine to show. A request
 * that fails validation gives `detail` as a *list of objects* - one per bad
 * field - and passing that to `new Error()` produces the string
 * "[object Object]", which is what the visa upload showed when the backend did
 * not yet know about the `visa` section.
 *
 * That is worse than an ugly message: it hides the one sentence that would
 * have explained the failure. Here the validation errors are unpacked instead,
 * so the reason survives to the screen.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  const detail = (body as any)?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item
        const msg = item?.msg || item?.message
        if (!msg) return ''
        // `loc` is the path to the offending field, e.g. ["path", "section"].
        const where = Array.isArray(item?.loc) ? item.loc.filter((x: unknown) => typeof x === 'string').slice(-1)[0] : ''
        return where ? `${where}: ${msg}` : String(msg)
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }

  if (detail && typeof detail === 'object') {
    const msg = (detail as any).msg || (detail as any).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }

  const message = (body as any)?.message
  if (typeof message === 'string' && message.trim()) return message

  return fallback
}
