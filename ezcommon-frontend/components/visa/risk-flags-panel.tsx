"use client"
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { loadProfileContext } from '@/lib/essay-store'

interface RiskFlag {
  field: string
  severity: 'high' | 'medium' | 'low'
  message: string
}

const severityStyle: Record<RiskFlag['severity'], string> = {
  high: 'border-destructive/40 bg-destructive/5 text-destructive',
  medium: 'border-amber-400/40 bg-amber-50 text-amber-700',
  low: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
}

export function RiskFlagsPanel({
  userId,
  section,
  answers,
}: {
  userId: string
  section: string
  answers: Record<string, string>
}) {
  const t = useT()
  const [flags, setFlags] = useState<RiskFlag[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runCheck() {
    setChecking(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/risk-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          section,
          answers,
          profile_context: loadProfileContext(userId),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Risk check failed')
      setFlags(data.flags || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-primary">{t('ds160.riskCheck.title')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={runCheck} disabled={checking}>
          {checking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          {t('ds160.riskCheck.runButton')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t('ds160.riskCheck.disclaimer')}</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {flags !== null && (
        <div className="space-y-2 mt-2">
          {flags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {t('ds160.riskCheck.noFlags')}
            </div>
          ) : (
            flags.map((flag, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2 text-sm ${severityStyle[flag.severity]}`}>
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t(`ds160.riskCheck.severity.${flag.severity}`)}
                </div>
                <p className="mt-0.5">{flag.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
