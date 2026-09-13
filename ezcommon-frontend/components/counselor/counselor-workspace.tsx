"use client"
import { useEffect, useState } from 'react'
import { DocumentsPanel } from '@/components/counselor/documents-panel'
import { TeamChat } from '@/components/counselor/team-chat'
import { InsightsPanel } from '@/components/counselor/insights-panel'
import { CaseNotes } from '@/components/counselor/case-notes'
import { useT } from '@/lib/i18n/use-t'
import { loadCounselorChat, saveCounselorChat, type CounselorMessage, type CounselorTab } from '@/lib/counselor-chat'
import { addCaseNote, loadCaseNotes, removeCaseNote, type CaseNote } from '@/lib/case-notes-store'
import { loadProfileContext } from '@/lib/essay-store'
import { loadColleges, CATEGORY_LABEL_KEY } from '@/lib/college-store'
import { computeApplicationTracker } from '@/lib/application-tracker'

const TABS: CounselorTab[] = ['team', 'strategist', 'essay', 'coordinator']

export function CounselorWorkspace({ userId }: { userId: string }) {
  const t = useT()
  const [activeTab, setActiveTab] = useState<CounselorTab>('team')
  const [messagesByTab, setMessagesByTab] = useState<Record<CounselorTab, CounselorMessage[]>>({
    team: [],
    strategist: [],
    essay: [],
    coordinator: [],
  })
  const [hasSavedHistory, setHasSavedHistory] = useState<Record<CounselorTab, boolean>>({
    team: false,
    strategist: false,
    essay: false,
    coordinator: false,
  })
  const [sending, setSending] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [docsRefreshSignal, setDocsRefreshSignal] = useState(0)
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([])

  useEffect(() => {
    const saved: Record<CounselorTab, boolean> = { team: false, strategist: false, essay: false, coordinator: false }
    for (const tab of TABS) saved[tab] = loadCounselorChat(userId, tab).length > 0
    setHasSavedHistory(saved)
    setCaseNotes(loadCaseNotes(userId))
  }, [userId])

  /** A one-line summary of the saved school list, so the counselors can name real schools. */
  function collegesSummary(): string {
    const colleges = loadColleges(userId)
    if (colleges.length === 0) return ''
    return colleges
      .map((c) => `${c.name} (${t(CATEGORY_LABEL_KEY[c.category])}${c.deadline ? `, due ${c.deadline}` : ''})`)
      .join('; ')
  }

  /** Where the student actually stands, so advice lands on the next real gap. */
  function progressSummary(): string {
    const tracker = computeApplicationTracker(userId, t)
    return [
      `Overall ${tracker.percent}% complete.`,
      ...tracker.stages.map((s) => `${s.label}: ${s.completed}/${s.total}`),
    ].join(' ')
  }

  function restore(tab: CounselorTab) {
    setMessagesByTab((prev) => ({ ...prev, [tab]: loadCounselorChat(userId, tab) }))
  }

  async function send(tab: CounselorTab, text: string) {
    const userMessage: CounselorMessage = { role: 'user', content: text }
    const history = [...messagesByTab[tab], userMessage]
    setMessagesByTab((prev) => ({ ...prev, [tab]: history }))
    setSending(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/counselor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: tab,
          message: text,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          profile_context: loadProfileContext(userId),
          colleges_summary: collegesSummary(),
          progress_summary: progressSummary(),
          case_notes: caseNotes.map((n) => n.text),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const next = [
        ...history,
        { role: 'assistant' as const, content: data.response, links: data.links || [] },
      ]
      setMessagesByTab((prev) => ({ ...prev, [tab]: next }))
      saveCounselorChat(userId, tab, next)
      setHasSavedHistory((prev) => ({ ...prev, [tab]: true }))
      // Anything durable this specialist learned becomes visible to the other three.
      if (data.note) setCaseNotes(addCaseNote(userId, data.note, tab))
    } catch (e) {
      const next = [...history, { role: 'assistant' as const, content: e instanceof Error ? e.message : 'Something went wrong.' }]
      setMessagesByTab((prev) => ({ ...prev, [tab]: next }))
    } finally {
      setSending(false)
    }
  }

  async function attach(files: FileList | null) {
    if (!files || files.length === 0) return
    setAttaching(true)
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const form = new FormData()
      form.append('user_id', userId)
      const names: string[] = []
      Array.from(files).forEach((f) => {
        form.append('files', f)
        names.push(f.name)
      })
      await fetch(`${base}/api/upload/profile`, { method: 'POST', body: form })
      setDocsRefreshSignal((n) => n + 1)
      await send(activeTab, t('counselor.chat.attachedMessage').replace('{files}', names.join(', ')))
    } finally {
      setAttaching(false)
    }
  }

  function quickAsk(text: string) {
    setActiveTab('team')
    send('team', text)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <DocumentsPanel userId={userId} refreshSignal={docsRefreshSignal} />
      <TeamChat
        activeTab={activeTab}
        onTabChange={setActiveTab}
        messages={messagesByTab[activeTab]}
        sending={sending}
        hasSavedHistory={hasSavedHistory[activeTab]}
        onRestore={() => restore(activeTab)}
        onSend={(text) => send(activeTab, text)}
        onAttach={attach}
        attaching={attaching}
        notesSlot={
          <CaseNotes
            notes={caseNotes}
            activeTab={activeTab}
            onRemove={(id) => setCaseNotes(removeCaseNote(userId, id))}
          />
        }
      />
      <InsightsPanel userId={userId} onQuickAsk={quickAsk} />
    </div>
  )
}
