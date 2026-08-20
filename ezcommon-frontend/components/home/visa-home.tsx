"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { DS160_SECTIONS } from '@/lib/ds160-schema'
import { loadDS160Data } from '@/lib/ds160-store'
import { loadVisaPrep, REQUIRED_DOCUMENTS } from '@/lib/visa-prep-store'
import { useT } from '@/lib/i18n/use-t'

export function VisaHome({ userId }: { userId: string }) {
  const t = useT()
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [docsChecked, setDocsChecked] = useState(0)

  useEffect(() => {
    const ds160 = loadDS160Data(userId)
    const confirmed = (ds160['_confirmed'] as Record<string, string>) || {}
    setConfirmedCount(DS160_SECTIONS.filter((s) => confirmed[s.key] === 'true').length)
    const prep = loadVisaPrep(userId)
    setDocsChecked(REQUIRED_DOCUMENTS.filter((k) => prep.documentsChecked[k]).length)
  }, [userId])

  const totalSections = DS160_SECTIONS.length

  return (
    <div className="grid sm:grid-cols-2 gap-4">
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
            {docsChecked}/{REQUIRED_DOCUMENTS.length}
          </p>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('home.visa.prepSubtitle')}</p>
      </Link>
    </div>
  )
}
