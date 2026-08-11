"use client"
import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildAutofillExport } from '@/lib/autofill-export'

export function AutofillBanner({ userId }: { userId: string }) {
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
              Autofill plugin
              <span className="rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5">BETA</span>
            </p>
            <p className="text-xs text-primary-foreground/70 max-w-md">
              Installs in Chrome — reads the field labels on any application portal and fills what it can from your
              saved Aipply data.
            </p>
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
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Copy my data for the plugin
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setShowInstructions((v) => !v)}
          >
            Install for Chrome
            {showInstructions ? <ChevronUp className="h-3.5 w-3.5 ml-2" /> : <ChevronDown className="h-3.5 w-3.5 ml-2" />}
          </Button>
        </div>
      </div>

      {showInstructions && (
        <div className="mt-4 pt-4 border-t border-white/15 text-sm text-primary-foreground/90 space-y-2">
          <p className="font-medium">This is an unpacked dev build (not on the Chrome Web Store yet):</p>
          <ol className="list-decimal list-inside space-y-1 text-primary-foreground/80">
            <li>
              Grab the <code className="bg-white/10 rounded px-1 py-0.5">browser-extension/</code> folder from the
              repo.
            </li>
            <li>
              Open <code className="bg-white/10 rounded px-1 py-0.5">chrome://extensions</code>, turn on
              &quot;Developer mode&quot;.
            </li>
            <li>
              Click &quot;Load unpacked&quot; and select the <code className="bg-white/10 rounded px-1 py-0.5">browser-extension/</code>{' '}
              folder.
            </li>
            <li>
              Click &quot;Copy my data for the plugin&quot; above, open the extension, and paste it in once.
            </li>
            <li>On any application page, click the extension icon, then &quot;Fill this page&quot;.</li>
          </ol>
        </div>
      )}
    </div>
  )
}
