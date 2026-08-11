"use client"
import { Loader2, Puzzle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

export function SubmitPluginBanner() {
  const t = useT()
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent shrink-0">
          <Puzzle className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-primary">{t('applicationForm.banner.autofillTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('applicationForm.banner.autofillDesc')}</p>
        </div>
      </div>
      <Button asChild size="sm">
        <a href="/submit">{t('applicationForm.banner.openSubmit')}</a>
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
  const t = useT()
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4 flex-wrap mt-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {t('applicationForm.banner.suggestionsLabel')}
          </span>
          {hasSuggestions && (
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">{t('applicationForm.banner.needsAttention')}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {hasSuggestions ? t('applicationForm.banner.suggestionsDescHas') : t('applicationForm.banner.suggestionsDescEmpty')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              {t('applicationForm.banner.generating')}
            </>
          ) : (
            t('applicationForm.banner.generateBtn')
          )}
        </Button>
        <Button size="sm" disabled={!hasSuggestions} onClick={onApplyAll}>
          {t('applicationForm.banner.applyAll')}
        </Button>
      </div>
    </div>
  )
}
