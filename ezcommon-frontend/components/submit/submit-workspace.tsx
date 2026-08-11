"use client"
import { useEffect, useState } from 'react'
import { loadColleges, saveColleges, type SavedCollege } from '@/lib/college-store'
import { SubmitHeader } from '@/components/submit/submit-header'
import { AutofillBanner } from '@/components/submit/autofill-banner'
import { PortalCards } from '@/components/submit/portal-cards'
import { ApplicationsList } from '@/components/submit/applications-list'

export function SubmitWorkspace({ userId, firstName }: { userId: string; firstName: string }) {
  const [colleges, setColleges] = useState<SavedCollege[]>([])

  useEffect(() => {
    setColleges(loadColleges(userId))
  }, [userId])

  function toggleSubmitted(id: string) {
    const next = colleges.map((c) => (c.id === id ? { ...c, submitted: !c.submitted } : c))
    setColleges(next)
    saveColleges(userId, next)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <SubmitHeader firstName={firstName} colleges={colleges} />
      <AutofillBanner userId={userId} />
      <div className="mt-6">
        <PortalCards colleges={colleges} />
        <ApplicationsList colleges={colleges} onToggleSubmitted={toggleSubmitted} />
      </div>
    </div>
  )
}
