"use client"
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

export function FeedbackButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [value, setValue] = useState('')

  return (
    // Lifted and shrunk on a phone: at bottom-right it sat exactly on the
    // send button of every composer in the app.
    <div className="fixed bottom-20 right-3 z-30 sm:bottom-6 sm:right-6 sm:z-50">
      {open && (
        <div className="mb-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border bg-card p-4 shadow-lg">
          <p className="text-sm font-semibold text-primary mb-2">{t('feedbackWidget.title')}</p>
          {sent ? (
            <p className="text-sm text-muted-foreground">{t('feedbackWidget.thanks')}</p>
          ) : (
            <>
              <textarea
                className="w-full min-h-20 rounded-md border p-2 text-sm resize-none"
                placeholder={t('feedbackWidget.placeholder')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full mt-2"
                disabled={!value.trim()}
                onClick={() => setSent(true)}
              >
                {t('feedbackWidget.send')}
              </Button>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (sent) {
            setSent(false)
            setValue('')
          }
        }}
        className="flex items-center gap-2 rounded-full border bg-card px-3 py-2.5 text-sm font-medium text-primary shadow-lg transition-colors hover:bg-muted sm:px-4"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">{t('feedbackWidget.button')}</span>
      </button>
    </div>
  )
}
