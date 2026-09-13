"use client"
import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildAutofillExport } from '@/lib/autofill-export'
import { cn } from '@/lib/utils'
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

type SyncState = 'idle' | 'syncing' | 'synced' | 'notInstalled'

export function AutofillBanner({ userId }: { userId: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [sync, setSync] = useState<SyncState>('idle')
  const [syncedCount, setSyncedCount] = useState(0)

  async function copyExport() {
    const fields = buildAutofillExport(userId)
    await navigator.clipboard.writeText(JSON.stringify(fields, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Hands the export straight to the extension's content script. Silence means
   * the extension isn't installed, so we fall back to the copy-paste route
   * instead of leaving the student waiting on a reply that never comes.
   */
  function syncToExtension() {
    setSync('syncing')
    const fields = buildAutofillExport(userId)

    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onReply)
      setSync('notInstalled')
      setShowInstructions(true)
    }, 1200)

    function onReply(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return
      if ((event.data as any)?.type !== 'AIPPLY_SYNC_OK') return
      window.clearTimeout(timeout)
      window.removeEventListener('message', onReply)
      setSyncedCount(Number((event.data as any).count) || 0)
      setSync('synced')
      window.setTimeout(() => setSync('idle'), 3000)
    }

    window.addEventListener('message', onReply)
    window.postMessage({ type: 'AIPPLY_SYNC', fields }, window.location.origin)
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
            onClick={syncToExtension}
            disabled={sync === 'syncing'}
            className={cn(sync === 'synced' && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100')}
          >
            {sync === 'syncing' && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            {sync === 'synced' && <Check className="h-3.5 w-3.5 mr-2" />}
            {sync === 'synced'
              ? t('submit.autofill.synced').replace('{count}', String(syncedCount))
              : t('submit.autofill.sync')}
          </Button>
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
        <div className="mt-4 pt-4 border-t border-white/15 text-sm text-primary-foreground/90 space-y-2 animate-fade-in-up motion-reduce:animate-none">
          {sync === 'notInstalled' && (
            <p className="rounded-lg bg-white/10 px-3 py-2 text-xs">{t('submit.autofill.notInstalled')}</p>
          )}
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
