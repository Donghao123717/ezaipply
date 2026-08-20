"use client"
import { useEffect, useState } from 'react'
import { CheckCircle2, Info } from 'lucide-react'
import { loadVisaPrep, saveVisaPrep, REQUIRED_DOCUMENTS, type VisaPrepData, type RequiredDocumentKey } from '@/lib/visa-prep-store'
import { useT } from '@/lib/i18n/use-t'

const TIP_KEYS = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'] as const

export function PrepTracker({ userId }: { userId: string }) {
  const t = useT()
  const [data, setData] = useState<VisaPrepData | null>(null)

  useEffect(() => {
    setData(loadVisaPrep(userId))
  }, [userId])

  function update(patch: Partial<VisaPrepData>) {
    setData((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      saveVisaPrep(userId, next)
      return next
    })
  }

  function toggleDoc(key: RequiredDocumentKey) {
    if (!data) return
    update({ documentsChecked: { ...data.documentsChecked, [key]: !data.documentsChecked[key] } })
  }

  if (!data) return null

  const checkedCount = REQUIRED_DOCUMENTS.filter((k) => data.documentsChecked[k]).length

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t('visaPrep.eyebrow')}</p>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('visaPrep.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('visaPrep.subtitle')}</p>
      </div>

      <div className="rounded-xl border bg-secondary/30 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">{t('visaPrep.disclaimer')}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-primary">{t('visaPrep.statusTitle')}</h2>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.sevisFeepaid}
            onChange={(e) => update({ sevisFeepaid: e.target.checked })}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">{t('visaPrep.sevisFeePaid')}</span>
        </label>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            {t('visaPrep.ds160Barcode')}
          </label>
          <input
            value={data.ds160ConfirmationBarcode}
            onChange={(e) => update({ ds160ConfirmationBarcode: e.target.value })}
            placeholder={t('visaPrep.ds160BarcodePlaceholder')}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('visaPrep.consulate')}
            </label>
            <input
              value={data.consulate}
              onChange={(e) => update({ consulate: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t('visaPrep.appointmentDate')}
            </label>
            <input
              type="date"
              value={data.appointmentDate}
              onChange={(e) => update({ appointmentDate: e.target.value })}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-primary">{t('visaPrep.documentsTitle')}</h2>
          <span className="text-xs text-muted-foreground">
            {checkedCount} / {REQUIRED_DOCUMENTS.length}
          </span>
        </div>
        <div className="space-y-1">
          {REQUIRED_DOCUMENTS.map((key) => (
            <label key={key} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 cursor-pointer">
              <input
                type="checkbox"
                checked={!!data.documentsChecked[key]}
                onChange={() => toggleDoc(key)}
                className="h-4 w-4 rounded accent-primary shrink-0"
              />
              <span className="text-sm text-foreground">{t(`visaPrep.documents.${key}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold text-primary mb-3">{t('visaPrep.tipsTitle')}</h2>
        <ul className="space-y-2">
          {TIP_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              {t(`visaPrep.tips.${key}`)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
