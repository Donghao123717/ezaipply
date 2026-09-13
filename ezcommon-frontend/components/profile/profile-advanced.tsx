"use client"
import { useState } from 'react'
import { ChevronDown, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { PROFILE_SECTIONS } from '@/lib/profile-schema'

type ProfileData = Record<string, any>

/** Everything this student owns, so "clear" really clears. */
function userScopedKeys(userId: string): string[] {
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith('aipply-') && key.includes(userId)) keys.push(key)
  }
  return keys
}

function renderValue(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) {
    return value
      .map((item, i) =>
        typeof item === 'object'
          ? `  ${i + 1}. ` +
            Object.entries(item)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : `  ${i + 1}. ${item}`,
      )
      .join('\n')
  }
  return String(value)
}

export function ProfileAdvanced({
  userId,
  data,
  firstName,
  lastName,
}: {
  userId: string
  data: ProfileData
  firstName: string
  lastName: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  /**
   * Opens a print-ready view and lets the browser write the PDF. Going through
   * print keeps the export honest - what the student sees is what they get -
   * and avoids shipping a PDF library for one button.
   */
  function exportPdf() {
    const rows: string[] = []
    for (const section of PROFILE_SECTIONS) {
      const sectionData = data[section.key]
      if (!sectionData) continue
      const body = renderValue(
        Array.isArray(sectionData)
          ? sectionData
          : Object.fromEntries(Object.entries(sectionData).filter(([, v]) => v)),
      )
      const flat =
        Array.isArray(sectionData)
          ? body
          : Object.entries(sectionData)
              .filter(([, v]) => v && typeof v !== 'object')
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')
      if (!flat.trim()) continue
      rows.push(
        `<section><h2>${t(section.labelKey)}</h2><pre>${flat
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre></section>`,
      )
    }

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${firstName} ${lastName} — Aipply Profile</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1.5rem;color:#1f2430;line-height:1.6}
  h1{font-size:1.6rem;margin-bottom:.25rem}
  .meta{color:#6b7280;font-size:.8rem;margin-bottom:2rem}
  h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:1.75rem 0 .4rem;border-bottom:1px solid #e5e7eb;padding-bottom:.3rem}
  pre{font-family:inherit;white-space:pre-wrap;margin:0;font-size:.9rem}
  @media print{body{margin:0}}
</style></head><body>
<h1>${firstName} ${lastName}</h1>
<div class="meta">${t('profile.advanced.exportSubtitle')} · ${new Date().toLocaleDateString()}</div>
${rows.join('') || `<p>${t('profile.advanced.exportEmpty')}</p>`}
</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  function clearProfile() {
    setClearing(true)
    for (const key of userScopedKeys(userId)) window.localStorage.removeItem(key)
    // Clear the server copy too, or the next load pulls everything back.
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    const entries = Object.fromEntries(userScopedKeys(userId).map((k) => [k, null]))
    fetch(`${base}/api/user-state/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
      .catch(() => null)
      .finally(() => window.location.reload())
  }

  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        {t('profile.advanced.title')}
      </button>

      {open && (
        <div className="mt-2 space-y-2 animate-fade-in-up motion-reduce:animate-none">
          <Button variant="outline" size="sm" onClick={exportPdf} className="w-full justify-start">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {t('profile.advanced.export')}
          </Button>

          <div className="rounded-lg border border-dashed border-destructive/40 p-3">
            <p className="text-xs font-medium text-primary">{t('profile.advanced.clearTitle')}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {t('profile.advanced.clearBody')}
            </p>
            {confirming ? (
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={clearing}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={clearProfile}
                  disabled={clearing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  {t('profile.advanced.clearConfirm')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirming(true)} className="mt-2">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('profile.advanced.clear')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
