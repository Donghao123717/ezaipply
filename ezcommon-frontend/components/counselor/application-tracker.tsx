"use client"
import { useEffect, useState } from 'react'
import { Check, CheckCircle2, ChevronDown, ChevronRight as ChevronRightIcon, Circle, MessageSquareText } from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/use-t'
import { computeApplicationTracker, findNextStep, type ApplicationTracker } from '@/lib/application-tracker'

export function ApplicationTrackerPanel({ userId, onQuickAsk }: { userId: string; onQuickAsk: (text: string) => void }) {
  const t = useT()
  const [tracker, setTracker] = useState<ApplicationTracker | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    const computed = computeApplicationTracker(userId, t)
    setTracker(computed)
    const next = findNextStep(computed)
    setExpandedKey(next?.stage.key ?? computed.stages[0]?.key ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!tracker) {
    return <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
  }

  const next = findNextStep(tracker)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-primary text-sm">Application Tracker</h3>
      </div>

      {next ? (
        <div className="rounded-xl bg-primary text-primary-foreground p-4 mb-4">
          <div className="flex items-start justify-between mb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/70">Your Next Step</p>
            <span className="text-xs font-semibold rounded-full bg-primary-foreground/15 px-2 py-0.5">{tracker.percent}%</span>
          </div>
          <p className="text-sm text-primary-foreground/80">Continue with {next.stage.label}</p>
          <p className="font-semibold">{next.item.label}</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onQuickAsk(`What should I do next for "${next.item.label}" in ${next.stage.label}?`)}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 px-2.5 py-1.5"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Quick Ask
            </button>
            <Link
              href={next.item.href}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium rounded-md bg-primary-foreground text-primary px-2.5 py-1.5"
            >
              Go
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-secondary/40 p-4 mb-4 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
          <p className="text-sm font-medium text-primary">Everything's done!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Every tracked step across your application is complete.</p>
        </div>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Progress by Stage</p>
      <div className="space-y-1">
        {tracker.stages.map((stage, i) => {
          const complete = stage.total > 0 && stage.completed === stage.total
          const expanded = expandedKey === stage.key
          return (
            <div key={stage.key} className="rounded-lg border overflow-hidden">
              <button
                onClick={() => setExpandedKey(expanded ? null : stage.key)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left"
              >
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                )}
                <span className={`text-sm flex-1 truncate ${complete ? 'text-primary' : 'text-foreground'} font-medium`}>
                  {stage.label}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {stage.completed}/{stage.total}
                </span>
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
              <div className="h-1 bg-muted">
                <div
                  className={`h-full ${complete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${stage.total > 0 ? (stage.completed / stage.total) * 100 : 0}%` }}
                />
              </div>
              {expanded && (
                <div className="px-3 py-2 space-y-1.5 border-t bg-muted/30">
                  {stage.items.length === 0 ? (
                    <Link href={stage.href} className="text-xs text-primary font-medium hover:underline">
                      Get started →
                    </Link>
                  ) : (
                    stage.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-2 text-xs hover:underline"
                      >
                        {item.done ? (
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{item.label}</span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
