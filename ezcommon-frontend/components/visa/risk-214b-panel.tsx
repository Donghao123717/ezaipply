"use client"
import { useState } from 'react'
import { Loader2, ShieldQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { useLocale } from '@/lib/i18n/locale-context'
import { loadDS160Context } from '@/lib/ds160-store'
import { loadProfileContext } from '@/lib/essay-store'
import type { VisaType } from '@/lib/visa-chat-store'
import { cn } from '@/lib/utils'

/**
 * Refusal risk under INA 214(b), broken into the factors behind it.
 *
 * A single number tells an applicant nothing they can act on - the forecast
 * module learned that for admissions chances, and it is the same here. Showing
 * the factors means there is something to go and fix, and separating "this is
 * weak" from "you have not told us yet" keeps a blank from reading as a verdict.
 */

interface Factor {
  key: string
  label: string
  score: number
  finding: string
  evidence: string[]
}

interface RiskResult {
  factors: Factor[]
  overall: number
  summary: string
  missing: string[]
}

function bandClass(score: number): string {
  if (score >= 67) return 'bg-emerald-500'
  if (score >= 34) return 'bg-amber-500'
  return 'bg-destructive'
}

export function Risk214bPanel({ userId, visaType }: { userId: string; visaType: VisaType }) {
  const t = useT()
  const { locale } = useLocale()
  const [result, setResult] = useState<RiskResult | null>(null)
  // Bars start at zero and grow once painted - a bar that mounts at its final
  // width reads as a static label rather than a measurement.
  const [grown, setGrown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/risk-214b`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visa_type: visaType,
          locale,
          ds160_context: loadDS160Context(userId),
          profile_context: loadProfileContext(userId),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || t('visaRisk.failed'))
      setGrown(false)
      setResult(data)
      window.setTimeout(() => setGrown(true), 40)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('visaRisk.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-primary">{t('visaRisk.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('visaRisk.intro')}</p>
          </div>
          <Button size="sm" onClick={run} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            {result ? t('visaRisk.rerun') : t('visaRisk.run')}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground/80">{t('visaRisk.disclaimer')}</p>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {!result && !busy && !error && (
          <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
            <ShieldQuestion className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('visaRisk.emptyState')}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-primary">{t('visaRisk.overall')}</p>
                <p className="font-display text-2xl font-semibold tabular-nums text-primary">
                  {result.overall}
                  <span className="ml-0.5 text-sm font-normal text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', bandClass(result.overall))}
                  style={{ width: grown ? `${result.overall}%` : '0%' }}
                />
              </div>
              {result.summary && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
              )}
            </div>

            <div className="space-y-4">
              {result.factors.map((f) => (
                <div key={f.key} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-primary">{f.label}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">{f.score}/100</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none', bandClass(f.score))}
                      style={{ width: grown ? `${f.score}%` : '0%' }}
                    />
                  </div>
                  {f.finding && <p className="mt-2.5 text-sm text-muted-foreground">{f.finding}</p>}
                  {f.evidence.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {f.evidence.map((e, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-muted-foreground/80">
                          <span aria-hidden>·</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* A blank is not a low score - say which it is. */}
            {result.missing.length > 0 && (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
                <p className="text-sm font-medium text-primary">{t('visaRisk.missingTitle')}</p>
                <ul className="mt-2 space-y-1">
                  {result.missing.map((m, i) => (
                    <li key={i} className="flex gap-1.5 text-sm text-muted-foreground">
                      <span aria-hidden>·</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
