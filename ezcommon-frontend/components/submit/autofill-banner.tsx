"use client"
import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildAutofillExport } from '@/lib/autofill-export'
import { useT } from '@/lib/i18n/use-t'

function withCode(template: string, code: string) {
  const [before, after] = template.split('{code}')
  return (
    <>
      {before}
      <code className="bg-white/10 rounded px-1 py-0.5">{code}</code>
      {after}
    </>
  )
}

export function AutofillBanner({ userId }: { userId: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  async function copyExport() {
    const fields = buildAutofillExport(userId)
    await navigator.clipboard.writeText(JSON.stringify(fields, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border bg-primary text-primary-foreground p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 shrink-0">
            <Puzzle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              {t('submit.autofill.title')}
              <span className="rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5">{t('submit.autofill.beta')}</span>
            </p>
            <p className="text-xs text-primary-foreground/70 max-w-md">{t('submit.autofill.description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={copyExport}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-2" />
                {t('submit.autofill.copied')}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-2" />
                {t('submit.autofill.copyData')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setShowInstructions((v) => !v)}
          >
            {t('submit.autofill.installChrome')}
            {showInstructions ? <ChevronUp className="h-3.5 w-3.5 ml-2" /> : <ChevronDown className="h-3.5 w-3.5 ml-2" />}
          </Button>
        </div>
      </div>

      {showInstructions && (
        <div className="mt-4 pt-4 border-t border-white/15 text-sm text-primary-foreground/90 space-y-2">
          <p className="font-medium">{t('submit.autofill.devBuildNote')}</p>
          <ol className="list-decimal list-inside space-y-1 text-primary-foreground/80">
            <li>{withCode(t('submit.autofill.step1'), 'browser-extension/')}</li>
            <li>{withCode(t('submit.autofill.step2'), 'chrome://extensions')}</li>
            <li>{withCode(t('submit.autofill.step3'), 'browser-extension/')}</li>
            <li>{t('submit.autofill.step4')}</li>
            <li>{t('submit.autofill.step5')}</li>
          </ol>
        </div>
      )}
    </div>
  )
}
