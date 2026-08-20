"use client"
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { loadVisaChat, saveVisaChat, type VisaChatMessage } from '@/lib/visa-chat-store'
import { loadDS160Context, loadDS160Data } from '@/lib/ds160-store'
import { loadProfileContext } from '@/lib/essay-store'
import { computeDS160Progress } from '@/lib/ds160-schema'
import { cn } from '@/lib/utils'

export function VisaCounselor({ userId }: { userId: string }) {
  const t = useT()
  const [messages, setMessages] = useState<VisaChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<ReturnType<typeof computeDS160Progress>>({ confirmed: 0, total: 0, sections: [] })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(loadVisaChat(userId))
    const ds160 = loadDS160Data(userId)
    const travel = ds160['travel'] as Record<string, any> | undefined
    const purposes = Array.isArray(travel?.tripPurposes) ? (travel!.tripPurposes as Record<string, string>[]) : []
    const isF1 = purposes.some((p) => p.specify === 'STUDENT (F1)' || p.purposeClass === 'ACADEMIC OR LANGUAGE STUDENT (F)')
    setProgress(computeDS160Progress(ds160, isF1))
  }, [userId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || sending) return
    const userMessage: VisaChatMessage = { role: 'user', content: input.trim() }
    const history = [...messages, userMessage]
    setMessages(history)
    setInput('')
    setSending(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          ds160_context: loadDS160Context(userId),
          profile_context: loadProfileContext(userId),
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const next = [...history, { role: 'assistant' as const, content: data.response }]
      setMessages(next)
      saveVisaChat(userId, next)
    } catch (e) {
      const next = [...history, { role: 'assistant' as const, content: e instanceof Error ? e.message : 'Something went wrong.' }]
      setMessages(next)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-72 shrink-0 border-r bg-card/50 h-full overflow-y-auto p-4">
        <h2 className="font-semibold text-primary mb-1">{t('ds160.counselor.checklistTitle')}</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {progress.confirmed} / {progress.total} {t('ds160.counselor.pagesConfirmed')}
        </p>
        <div className="space-y-1">
          {progress.sections.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg">
              <CheckCircle2 className={cn('h-4 w-4 shrink-0', s.confirmed ? 'text-emerald-500' : 'text-muted-foreground/30')} />
              <span className={cn('truncate', !s.confirmed && 'text-muted-foreground')}>{t(s.labelKey)}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('ds160.counselor.emptyState')}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={t('ds160.counselor.inputPlaceholder')}
              className="flex-1 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
