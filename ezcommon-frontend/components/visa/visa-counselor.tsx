"use client"
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { TeamChat, type PersonaMeta } from '@/components/counselor/team-chat'
import { CaseNotes } from '@/components/counselor/case-notes'
import { MockInterview } from '@/components/visa/mock-interview'
import { Risk214bPanel } from '@/components/visa/risk-214b-panel'
import { useT } from '@/lib/i18n/use-t'
import {
  loadVisaChat,
  saveVisaChat,
  loadVisaType,
  saveVisaType,
  VISA_TABS,
  type VisaChatMessage,
  type VisaTab,
  type VisaType,
} from '@/lib/visa-chat-store'
import { addCaseNote, loadCaseNotes, removeCaseNote, type CaseNote } from '@/lib/case-notes-store'
import { loadDS160Context, loadDS160Data } from '@/lib/ds160-store'
import { loadProfileContext } from '@/lib/essay-store'
import { computeDS160Progress } from '@/lib/ds160-schema'
import { cn } from '@/lib/utils'

const PERSONAS: PersonaMeta[] = VISA_TABS.map((tab) => ({ tab, dictKey: tab }))

export function VisaCounselor({ userId }: { userId: string }) {
  const t = useT()
  const [activeTab, setActiveTab] = useState<VisaTab>('interviewer')
  const [visaType, setVisaType] = useState<VisaType>('F1')
  const [messagesByTab, setMessagesByTab] = useState<Record<VisaTab, VisaChatMessage[]>>({
    interviewer: [],
    documents: [],
    risk: [],
    coordinator: [],
  })
  const [notes, setNotes] = useState<CaseNote[]>([])
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<ReturnType<typeof computeDS160Progress>>({
    confirmed: 0,
    total: 0,
    sections: [],
  })

  useEffect(() => {
    const loaded = {} as Record<VisaTab, VisaChatMessage[]>
    for (const tab of VISA_TABS) loaded[tab] = loadVisaChat(userId, tab)
    setMessagesByTab(loaded)
    setNotes(loadCaseNotes(userId))

    const ds160 = loadDS160Data(userId)
    const travel = ds160['travel'] as Record<string, any> | undefined
    const purposes = Array.isArray(travel?.tripPurposes) ? (travel!.tripPurposes as Record<string, string>[]) : []
    const isF1 = purposes.some(
      (p) => p.specify === 'STUDENT (F1)' || p.purposeClass === 'ACADEMIC OR LANGUAGE STUDENT (F)',
    )
    setProgress(computeDS160Progress(ds160, isF1))
    // The DS-160's own trip purpose is better evidence than a saved preference,
    // so it wins when the applicant has actually filled it in.
    setVisaType(isF1 ? 'F1' : loadVisaType(userId))
  }, [userId])

  function changeVisaType(next: VisaType) {
    setVisaType(next)
    saveVisaType(userId, next)
  }

  async function send(tab: VisaTab, text: string) {
    if (!text.trim() || sending) return
    const history = [...messagesByTab[tab], { role: 'user' as const, content: text.trim() }]
    setMessagesByTab((prev) => ({ ...prev, [tab]: history }))
    setSending(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/visa/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          agent: tab,
          visa_type: visaType,
          ds160_context: loadDS160Context(userId),
          profile_context: loadProfileContext(userId),
          history: history.map((m) => ({ role: m.role, content: m.content })),
          case_notes: notes.map((n) => n.text),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || t('visaCounselor.failed'))

      const next = [
        ...history,
        {
          role: 'assistant' as const,
          content: data.response,
          links: data.links || [],
          reasoning: data.reasoning || [],
        },
      ]
      setMessagesByTab((prev) => ({ ...prev, [tab]: next }))
      saveVisaChat(userId, tab, next)
      if (data.note) setNotes(addCaseNote(userId, data.note, tab as any))
    } catch (e) {
      const next = [
        ...history,
        { role: 'assistant' as const, content: e instanceof Error ? e.message : t('visaCounselor.failed') },
      ]
      setMessagesByTab((prev) => ({ ...prev, [tab]: next }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="h-full w-72 shrink-0 overflow-y-auto border-r bg-card/50 p-4">
        {/* F-1 and B1/B2 interviews barely overlap, so this steers every prompt. */}
        <h2 className="mb-1 font-semibold text-primary">{t('visaCounselor.visaTypeTitle')}</h2>
        <div className="mb-5 inline-flex rounded-md border p-0.5 text-xs">
          {(['F1', 'B1B2'] as VisaType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => changeVisaType(type)}
              aria-pressed={visaType === type}
              className={cn(
                'rounded-sm px-3 py-1 transition-colors',
                visaType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`visaCounselor.visaType.${type}`)}
            </button>
          ))}
        </div>

        <h2 className="mb-1 font-semibold text-primary">{t('ds160.counselor.checklistTitle')}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {progress.confirmed} / {progress.total} {t('ds160.counselor.pagesConfirmed')}
        </p>
        <div className="space-y-1">
          {progress.sections.map((s) => (
            <div key={s.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
              <CheckCircle2
                className={cn('h-4 w-4 shrink-0', s.confirmed ? 'text-emerald-500' : 'text-muted-foreground/30')}
              />
              <span className={cn('truncate', !s.confirmed && 'text-muted-foreground')}>{t(s.labelKey)}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The interviewer and the risk analyst are not conversations - one runs a
            drill, the other renders a breakdown - so they get their own surfaces
            while the other two share the chat the admissions side uses. */}
        {activeTab === 'interviewer' || activeTab === 'risk' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-6 pt-4">
              <TabRow personas={PERSONAS} active={activeTab} onChange={setActiveTab} t={t} />
            </div>
            <div className="min-h-0 flex-1">
              {activeTab === 'interviewer' ? (
                <MockInterview userId={userId} visaType={visaType} />
              ) : (
                <Risk214bPanel userId={userId} visaType={visaType} />
              )}
            </div>
          </div>
        ) : (
          <TeamChat
            personas={PERSONAS}
            dictNamespace="visaCounselor"
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as VisaTab)}
            messages={messagesByTab[activeTab]}
            sending={sending}
            hasSavedHistory={false}
            onRestore={() => {}}
            onSend={(text) => send(activeTab, text)}
            onAttach={() => {}}
            attaching={false}
            notesSlot={
              <CaseNotes
                notes={notes}
                activeTab={activeTab}
                dictNamespace="visaCounselor"
                onRemove={(id) => setNotes(removeCaseNote(userId, id))}
              />
            }
          />
        )}
      </div>
    </div>
  )
}

/** The same four tabs, for the two panels that do not use TeamChat's own row. */
function TabRow({
  personas,
  active,
  onChange,
  t,
}: {
  personas: PersonaMeta[]
  active: string
  onChange: (tab: VisaTab) => void
  t: (key: string) => string
}) {
  return (
    <div role="tablist" className="flex gap-1">
      {personas.map((p) => (
        <button
          key={p.tab}
          role="tab"
          aria-selected={active === p.tab}
          onClick={() => onChange(p.tab as VisaTab)}
          className={cn(
            'rounded-t-md px-3 py-2 text-sm transition-colors',
            active === p.tab
              ? 'border-b-2 border-primary font-medium text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`visaCounselor.personas.${p.dictKey}.navLabel`)}
        </button>
      ))}
    </div>
  )
}
