"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight, History, LayoutPanelLeft, Loader2, MessageCircle, PanelRight, Paperclip, Send, X, Zap } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from '@/lib/i18n/use-t'
import type { CounselorMessage } from '@/lib/counselor-chat'
import { COMMAND_GROUPS, filterCommands, type CounselorCommand } from '@/lib/counselor-commands'

/**
 * The specialists shown as tabs. The admissions side and the visa side both use
 * this component with their own four, so the tab keys and the dictionary
 * namespace are passed in rather than hard-coded.
 */
export interface PersonaMeta {
  tab: string
  dictKey: string
}

export const COUNSELOR_PERSONAS: PersonaMeta[] = [
  { tab: 'team', dictKey: 'team' },
  { tab: 'strategist', dictKey: 'strategist' },
  { tab: 'essay', dictKey: 'essay' },
  { tab: 'coordinator', dictKey: 'coordinator' },
]

/** What the counselor checked before answering - collapsed, because it is
 * context for a doubtful reader rather than part of the answer. */
function ReasoningRow({ steps, label }: { steps: string[]; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {open && (
        <ol className="mt-1 ml-4 space-y-0.5 border-l pl-3">
          {steps.map((step, i) => (
            <li
              key={i}
              style={{ animationDelay: `${i * 50}ms` }}
              className="text-[11px] text-muted-foreground animate-fade-in-up motion-reduce:animate-none"
            >
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function TeamChat({
  personas = COUNSELOR_PERSONAS,
  dictNamespace = 'counselor',
  activeTab,
  onTabChange,
  messages,
  sending,
  hasSavedHistory,
  onRestore,
  onSend,
  onAttach,
  attaching,
  onOpenDocuments,
  onOpenInsights,
  notesSlot,
}: {
  /** Which specialists to show. Defaults to the admissions four. */
  personas?: PersonaMeta[]
  /** Dictionary prefix for persona copy, e.g. "counselor" or "visaCounselor". */
  dictNamespace?: string
  activeTab: string
  onTabChange: (tab: string) => void
  messages: CounselorMessage[]
  sending: boolean
  hasSavedHistory: boolean
  onRestore: () => void
  onSend: (text: string) => void
  onAttach: (files: FileList | null) => void
  attaching: boolean
  /** Opens the rails that are slide-overs below lg. Absent on the visa side,
   *  which has no rails to open. */
  onOpenDocuments?: () => void
  onOpenInsights?: () => void
  notesSlot?: React.ReactNode
}) {
  const t = useT()
  const [input, setInput] = useState('')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  // The palette opens on "/" as the first character, and on the Quick Actions
  // button. `highlight` is the row Enter would send - it is kept in state
  // rather than read off focus so the student can keep typing to narrow the
  // list while the arrow keys move the selection.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const persona = personas.find((p) => p.tab === activeTab) ?? personas[0]
  const personaKey = (suffix: string) => `${dictNamespace}.personas.${persona.dictKey}.${suffix}`
  const suggested = [t(personaKey('quickAction1')), t(personaKey('quickAction2')), t(personaKey('quickAction3'))]

  // Everything after the leading "/" narrows the list as it is typed.
  const query = paletteOpen && input.startsWith('/') ? input.slice(1) : ''
  const matches = useMemo(() => (paletteOpen ? filterCommands(query, t) : []), [paletteOpen, query, t])
  const grouped = useMemo(() => {
    const map = new Map<string, CounselorCommand[]>()
    for (const c of matches) map.set(c.group, [...(map.get(c.group) || []), c])
    return COMMAND_GROUPS.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const)
  }, [matches])
  // The flat order the arrow keys walk, which has to match the render order.
  const ordered = useMemo(() => grouped.flatMap(([, list]) => list), [grouped])

  useEffect(() => {
    setBannerDismissed(false)
    setPaletteOpen(false)
  }, [activeTab])

  // A narrowed list can be shorter than where the cursor was.
  useEffect(() => {
    setHighlight((h) => (h < ordered.length ? h : 0))
  }, [ordered.length])

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    if (!paletteOpen) return
    paletteRef.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, paletteOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function send(text: string) {
    if (!text.trim() || sending) return
    setInput('')
    setPaletteOpen(false)
    onSend(text.trim())
  }

  /** Sends the question the shortcut stands for, not the shorthand itself. */
  function runCommand(command: CounselorCommand) {
    send(t(command.promptKey))
  }

  function openPalette() {
    setPaletteOpen(true)
    setHighlight(0)
    if (!input.startsWith('/')) setInput('/')
    inputRef.current?.focus()
  }

  const showBanner = hasSavedHistory && messages.length === 0 && !bannerDismissed

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {/* Below lg the two rails are slide-overs, so they need a way in. */}
          {onOpenDocuments && (
            <button
              onClick={onOpenDocuments}
              aria-label={t('counselor.documents.title')}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <LayoutPanelLeft className="h-4 w-4" />
            </button>
          )}
          <MessageCircle className="hidden h-4 w-4 shrink-0 text-accent sm:block" />
          <h1 className="min-w-0 truncate font-semibold text-primary">{t(personaKey('title'))}</h1>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
        {onOpenInsights && (
          <button
            onClick={onOpenInsights}
            aria-label={t('counselor.insights.title')}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onRestore}
          disabled={!hasSavedHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md border px-2.5 py-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('counselor.chat.history')}</span>
        </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="px-4 pt-3 sm:px-6">
          <TabsList className="max-w-full overflow-x-auto bg-muted/60">
            {personas.map((p) => (
              <TabsTrigger key={p.tab} value={p.tab}>
                {t(`${dictNamespace}.personas.${p.dictKey}.navLabel`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {showBanner && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-secondary/50 px-3 py-2 text-sm sm:mx-6">
          <History className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground">{t('counselor.chat.bannerHasPrevious')}</span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span className="hidden text-muted-foreground sm:inline">{t('counselor.chat.bannerPickUp')}</span>
          <button
            onClick={onRestore}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          >
            <History className="h-3 w-3" />
            {t('counselor.chat.restore')}
          </button>
          <button
            aria-label={t('counselor.chat.dismiss')}
            onClick={() => setBannerDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-primary text-lg mb-1.5">{t('counselor.chat.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t(personaKey('emptySubtitle'))}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'ml-10' : 'mr-10'}>
                {m.role === 'assistant' && m.reasoning && m.reasoning.length > 0 && (
                  <ReasoningRow steps={m.reasoning} label={t('counselor.chat.reasoning')} />
                )}
                <div
                  className={`text-sm rounded-xl px-4 py-2.5 whitespace-pre-wrap animate-fade-in-up motion-reduce:animate-none ${
                    m.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && m.links && m.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 hover:gap-1.5 transition-all"
                      >
                        {link.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-10">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('counselor.chat.thinking')}
              </div>
            )}
          </div>
        )}
      </div>

      {notesSlot}

      <div className="relative border-t px-4 py-3 sm:px-6">
        <div className="mb-2 flex items-center gap-3">
          <button
            onClick={() => (paletteOpen ? setPaletteOpen(false) : openPalette())}
            aria-expanded={paletteOpen}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Zap className="h-3.5 w-3.5" />
            {t('counselor.commands.title')}
          </button>
          <span className="text-xs text-muted-foreground">{t('counselor.commands.hint')}</span>
        </div>

        {/* The palette sits above the composer so the list grows upward and the
            text you are typing never moves. */}
        {paletteOpen && (
          <div
            ref={paletteRef}
            role="listbox"
            aria-label={t('counselor.commands.title')}
            className="absolute bottom-full left-4 right-4 z-20 mb-2 sm:left-6 sm:right-6 max-h-80 overflow-y-auto rounded-xl border bg-card shadow-lg animate-slide-up-in motion-reduce:animate-none"
          >
            {/* What this specialist would ask about right now, kept at the top
                because it is the one part of the list that changes with the tab. */}
            {!query && (
              <div className="border-b p-2">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(personaKey('navLabel'))}
                </p>
                {suggested.map((action) => (
                  <button
                    key={action}
                    onClick={() => send(action)}
                    className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}

            {ordered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{t('counselor.commands.noMatch')}</p>
            ) : (
              grouped.map(([group, list]) => (
                <div key={group} className="p-2">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`counselor.commands.groups.${group}`)}
                  </p>
                  {list.map((command) => {
                    const index = ordered.indexOf(command)
                    const isHighlighted = index === highlight
                    return (
                      <button
                        key={command.id}
                        role="option"
                        aria-selected={isHighlighted}
                        data-highlighted={isHighlighted}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => runCommand(command)}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left ${
                          isHighlighted ? 'bg-secondary' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="shrink-0 font-mono text-xs text-accent">/{command.id}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {t(command.labelKey)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => attachInputRef.current?.click()}
            disabled={attaching}
            aria-label={t('counselor.chat.attachAria')}
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
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const next = e.target.value
              setInput(next)
              // "/" only opens the palette as the first character - a slash
              // inside a sentence is a slash.
              if (next.startsWith('/')) {
                setPaletteOpen(true)
                setHighlight(0)
              } else {
                setPaletteOpen(false)
              }
            }}
            onBlur={() => {
              // Let a click on a palette row land before the palette closes.
              window.setTimeout(() => setPaletteOpen(false), 120)
            }}
            onKeyDown={(e) => {
              if (paletteOpen && ordered.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHighlight((h) => (h + 1) % ordered.length)
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHighlight((h) => (h - 1 + ordered.length) % ordered.length)
                  return
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  runCommand(ordered[highlight])
                  return
                }
              }
              if (e.key === 'Escape' && paletteOpen) {
                e.preventDefault()
                setPaletteOpen(false)
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder={t('counselor.chat.inputPlaceholder')}
            className="flex-1 min-h-9 max-h-32 resize-none rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            aria-label={t('common.send')}
            className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
