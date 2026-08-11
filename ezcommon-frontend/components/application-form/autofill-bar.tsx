"use client"
import { useState } from 'react'
import { Loader2, Puzzle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SubmitPluginBanner() {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent shrink-0">
          <Puzzle className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-primary">Autofill when you hit Submit</p>
          <p className="text-xs text-muted-foreground">
            When it&apos;s time to submit on Common App, UC, or an independent portal, our Chrome extension can
            autofill from your saved answers.
          </p>
        </div>
      </div>
      <Button asChild size="sm">
        <a href="/submit">Open Submit</a>
      </Button>
    </div>
  )
}

export function AutofillSuggestionsBar({
  loading,
  hasSuggestions,
  onGenerate,
  onApplyAll,
}: {
  loading: boolean
  hasSuggestions: boolean
  onGenerate: () => void
  onApplyAll: () => void
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4 flex-wrap mt-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Autofill suggestions
          </span>
          {hasSuggestions && (
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">Needs attention</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {hasSuggestions
            ? 'Generated suggestions cannot be applied to the current form. Review your existing answers and form selections, then run Autofill Generation again.'
            : "Generate suggested answers for this page from your profile, then apply the ones that look right."}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            'Autofill Generation'
          )}
        </Button>
        <Button size="sm" disabled={!hasSuggestions} onClick={onApplyAll}>
          Apply All
        </Button>
      </div>
    </div>
  )
}
