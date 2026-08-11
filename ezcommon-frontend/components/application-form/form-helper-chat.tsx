"use client"
import { useState } from 'react'
import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function FormHelperChat({ schoolName }: { schoolName: string }) {
  const t = useT()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!input.trim() || sending) return
    const userMessage: Message = { role: 'user', content: input.trim() }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/application-form/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: schoolName,
          message: userMessage.content,
          history: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
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
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('applicationForm.chat.subtitle')}</p>
          <h3 className="font-semibold text-primary">{t('applicationForm.chat.title')}</h3>
        </div>
        {messages.length > 0 && (
          <button aria-label={t('applicationForm.chat.clearAria')} onClick={() => setMessages([])} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-primary text-sm">{t('applicationForm.chat.askAbout').replace('{school}', schoolName)}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{t('applicationForm.chat.helpDesc')}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 ${
                m.role === 'user' ? 'bg-secondary text-secondary-foreground ml-6' : 'bg-muted mr-2'
              }`}
            >
              {m.content}
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('counselor.chat.thinking')}
          </div>
        )}
      </div>

      <div className="border-t p-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={t('applicationForm.chat.placeholder').replace('{school}', schoolName)}
          className="flex-1 min-h-9 max-h-24 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          aria-label={t('common.send')}
          className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
