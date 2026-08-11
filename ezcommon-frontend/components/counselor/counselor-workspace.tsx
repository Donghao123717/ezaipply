"use client"
import { useEffect, useState } from 'react'
import { DocumentsPanel } from '@/components/counselor/documents-panel'
import { TeamChat } from '@/components/counselor/team-chat'
import { InsightsPanel } from '@/components/counselor/insights-panel'
import { loadCounselorChat, saveCounselorChat, type CounselorMessage, type CounselorTab } from '@/lib/counselor-chat'

const TABS: CounselorTab[] = ['team', 'strategist', 'essay', 'coordinator']

export function CounselorWorkspace({ userId }: { userId: string }) {
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

  useEffect(() => {
    const saved: Record<CounselorTab, boolean> = { team: false, strategist: false, essay: false, coordinator: false }
    for (const tab of TABS) saved[tab] = loadCounselorChat(userId, tab).length > 0
    setHasSavedHistory(saved)
  }, [userId])

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
      const res = await fetch(`${base}/api/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Request failed')
      const next = [...history, { role: 'assistant' as const, content: data.response }]
      setMessagesByTab((prev) => ({ ...prev, [tab]: next }))
      saveCounselorChat(userId, tab, next)
      setHasSavedHistory((prev) => ({ ...prev, [tab]: true }))
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
      await send(activeTab, `I just uploaded ${names.join(', ')} to my documents.`)
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
      />
      <InsightsPanel userId={userId} onQuickAsk={quickAsk} />
    </div>
  )
}
