"use client"
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [value, setValue] = useState('')

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-2 w-72 rounded-xl border bg-card shadow-lg p-4">
          <p className="text-sm font-semibold text-primary mb-2">Send feedback</p>
          {sent ? (
            <p className="text-sm text-muted-foreground">Thanks — we read every note.</p>
          ) : (
            <>
              <textarea
                className="w-full min-h-20 rounded-md border p-2 text-sm resize-none"
                placeholder="What's working, what's not?"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full mt-2"
                disabled={!value.trim()}
                onClick={() => setSent(true)}
              >
                Send
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
        className="flex items-center gap-2 rounded-full bg-card border shadow-lg px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        Feedback
      </button>
    </div>
  )
}
