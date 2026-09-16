"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { DS160_SECTIONS } from '@/lib/ds160-schema'
import { loadDS160Data } from '@/lib/ds160-store'
import { loadVisaPrep, APPOINTMENT_DOCUMENTS } from '@/lib/visa-prep-store'
import { documentsFor } from '@/lib/visa-documents'
import { chosenVisaType, saveVisaType, type VisaType } from '@/lib/visa-chat-store'
import { VisaTypePicker } from '@/components/visa/visa-type-picker'
import { useT } from '@/lib/i18n/use-t'

export function VisaHome({ userId }: { userId: string }) {
  const t = useT()
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [docsChecked, setDocsChecked] = useState(0)
  const [docsTotal, setDocsTotal] = useState(0)
  const [visaType, setVisaType] = useState<VisaType | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const ds160 = loadDS160Data(userId)
    const confirmed = (ds160['_confirmed'] as Record<string, string>) || {}
    setConfirmedCount(DS160_SECTIONS.filter((s) => confirmed[s.key] === 'true').length)
    const prep = loadVisaPrep(userId)
    const type = chosenVisaType(userId)
    setVisaType(type)
    setHydrated(true)
    const keys = [...documentsFor(type || 'F1').map((d) => d.kind as string), ...APPOINTMENT_DOCUMENTS]
    setDocsTotal(keys.length)
    setDocsChecked(keys.filter((k) => prep.documentsChecked[k]).length)
  }, [userId])

  const totalSections = DS160_SECTIONS.length

  function choose(next: VisaType) {
    saveVisaType(userId, next)
    setVisaType(next)
  }

  if (!hydrated) return null

  // Nothing else is worth showing until we know which visa this is: every
  // number on the cards below is counted against a different checklist
  // depending on the answer.
  if (!visaType) {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold text-primary">{t('visaType.prompt')}</h2>
        <p className="mb-5 mt-1 max-w-2xl text-sm text-muted-foreground">{t('visaType.promptBody')}</p>
        <VisaTypePicker value={null} onChange={choose} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-primary">{t(`visaType.${visaType}.title`)}</h2>
          <span className="text-sm text-muted-foreground">{t(`visaType.${visaType}.who`)}</span>
        </div>
        <VisaTypePicker value={visaType} onChange={choose} compact />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Link href="/visa/ds160" className="rounded-xl border bg-card p-5 hover:border-primary/40 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('home.visa.ds160Label')}</p>
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl font-semibold text-primary">
            {confirmedCount}/{totalSections}
          </p>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('home.visa.ds160Subtitle')}</p>
      </Link>
      <Link href="/visa/prep" className="rounded-xl border bg-card p-5 hover:border-primary/40 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('home.visa.prepLabel')}</p>
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl font-semibold text-primary">
            {docsChecked}/{docsTotal}
          </p>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('home.visa.prepSubtitle')}</p>
      </Link>
      </div>
    </div>
  )
}
