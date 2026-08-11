"use client"
import { useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_ACTIONS = ['Make it more vivid', 'Tighten the language', 'Fix grammar & flow', 'Strengthen the ending']

export function EssayCoachPanel({
  hasDraft,
  essayHtml,
  prompt,
  onStartDraft,
  drafting,
}: {
  hasDraft: boolean
  essayHtml: string
  prompt: string
  onStartDraft: () => void
  drafting: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)

  async function send(text: string) {
    if (!text.trim() || sending) return
    const userMessage: Message = { role: 'user', content: text }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/essay/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          essay_content: essayHtml,
          prompt,
          history: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Coach request failed')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong.' },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-primary flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-accent" />
          Essay Coach
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasDraft ? 'Ask for feedback or a rewrite' : 'Start from scratch'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!hasDraft && messages.length === 0 && (
          <div className="text-center py-4">
            <Button onClick={onStartDraft} disabled={drafting} size="sm">
              {drafting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Drafting…
                </>
              ) : (
                'Start first draft'
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Draft from your profile — review the result in the editor.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg px-3 py-2 ${
              m.role === 'user' ? 'bg-secondary text-secondary-foreground ml-6' : 'bg-muted mr-2'
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t p-3">
        {showQuickActions && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => {
                  setShowQuickActions(false)
                  send(action)
                }}
                className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted"
              >
                {action}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowQuickActions((v) => !v)}
          className="text-xs font-medium text-primary mb-2 hover:underline"
        >
          Quick Actions
        </button>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Tell me a story or paste an outline..."
            className="flex-1 min-h-9 max-h-24 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
