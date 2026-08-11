"use client"
import { useEffect, useRef, useState } from 'react'
import { History, Loader2, MessageCircle, Paperclip, Send, X, Zap } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CounselorMessage, CounselorTab } from '@/lib/counselor-chat'

interface PersonaMeta {
  tab: CounselorTab
  navLabel: string
  title: string
  emptySubtitle: string
  quickActions: string[]
}

const PERSONAS: PersonaMeta[] = [
  {
    tab: 'team',
    navLabel: 'Team',
    title: 'Your Admissions Team',
    emptySubtitle: 'Tell the team what you are working on, and your lead counselor will ask the next useful follow-up question.',
    quickActions: ['What should I be working on right now?', 'Summarize my application status', "What's my biggest gap right now?"],
  },
  {
    tab: 'strategist',
    navLabel: 'Strategist',
    title: 'Your Strategist',
    emptySubtitle: 'Ask about building a balanced college list, or how to prioritize your time this month.',
    quickActions: ['Which schools should I add to my list?', 'Is my college list balanced?', 'What should I prioritize this month?'],
  },
  {
    tab: 'essay',
    navLabel: 'Essay',
    title: 'Your Essay Coach',
    emptySubtitle: 'Ask for help brainstorming a topic, outlining a draft, or reviewing something you already wrote.',
    quickActions: ['Help me brainstorm essay topics', 'Review my personal statement', 'How do I start my "why us" essay?'],
  },
  {
    tab: 'coordinator',
    navLabel: 'Coordinator',
    title: 'Your Coordinator',
    emptySubtitle: 'Ask about upcoming deadlines, missing documents, or what to submit next.',
    quickActions: ['What deadlines are coming up?', 'What documents am I still missing?', 'What should I submit next?'],
  },
]

export function TeamChat({
  activeTab,
  onTabChange,
  messages,
  sending,
  hasSavedHistory,
  onRestore,
  onSend,
  onAttach,
  attaching,
}: {
  activeTab: CounselorTab
  onTabChange: (tab: CounselorTab) => void
  messages: CounselorMessage[]
  sending: boolean
  hasSavedHistory: boolean
  onRestore: () => void
  onSend: (text: string) => void
  onAttach: (files: FileList | null) => void
  attaching: boolean
}) {
  const [input, setInput] = useState('')
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const persona = PERSONAS.find((p) => p.tab === activeTab)!

  useEffect(() => {
    setBannerDismissed(false)
    setShowQuickActions(false)
  }, [activeTab])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function send(text: string) {
    if (!text.trim() || sending) return
    setInput('')
    setShowQuickActions(false)
    onSend(text.trim())
  }

  const showBanner = hasSavedHistory && messages.length === 0 && !bannerDismissed

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-accent" />
          <h1 className="font-semibold text-primary">{persona.title}</h1>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>
        <button
          onClick={onRestore}
          disabled={!hasSavedHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md border px-2.5 py-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as CounselorTab)}>
        <div className="px-6 pt-3">
          <TabsList className="bg-muted/60">
            {PERSONAS.map((p) => (
              <TabsTrigger key={p.tab} value={p.tab}>
                {p.navLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {showBanner && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 text-sm">
          <History className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-foreground">You have a previous conversation</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Pick up where you left off</span>
          <button
            onClick={onRestore}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1"
          >
            <History className="h-3 w-3" />
            Restore
          </button>
          <button
            aria-label="Dismiss"
            onClick={() => setBannerDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-primary text-lg mb-1.5">What should we work on next?</p>
            <p className="text-sm text-muted-foreground">{persona.emptySubtitle}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl px-4 py-2.5 whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-secondary text-secondary-foreground ml-10' : 'bg-muted mr-10'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-10">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setShowQuickActions((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Zap className="h-3.5 w-3.5" />
            Quick Actions
          </button>
        </div>
        {showQuickActions && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {persona.quickActions.map((action) => (
              <button
                key={action}
                onClick={() => send(action)}
                className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted text-left"
              >
                {action}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => attachInputRef.current?.click()}
            disabled={attaching}
            aria-label="Attach a document"
            className="h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input
            ref={attachInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              onAttach(e.target.files)
              e.target.value = ''
            }}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Tell the team what you want to work on, or answer in your own words..."
            className="flex-1 min-h-9 max-h-32 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
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
