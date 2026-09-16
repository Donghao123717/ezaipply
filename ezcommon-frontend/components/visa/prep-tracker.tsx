"use client"
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info } from 'lucide-react'
import { loadVisaPrep, saveVisaPrep, APPOINTMENT_DOCUMENTS, type VisaPrepData, type RequiredDocumentKey, type VisaDocFile } from '@/lib/visa-prep-store'
import { documentsFor } from '@/lib/visa-documents'
import { loadVisaType, type VisaType } from '@/lib/visa-chat-store'
import { VisaDocumentUpload } from '@/components/visa/document-upload'
import { useT } from '@/lib/i18n/use-t'

const TIP_KEYS = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'] as const

export function PrepTracker({ userId }: { userId: string }) {
  const t = useT()
  const [data, setData] = useState<VisaPrepData | null>(null)
  const [visaType, setVisaType] = useState<VisaType>('F1')

  useEffect(() => {
    setData(loadVisaPrep(userId))
    setVisaType(loadVisaType(userId))
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

  function addFiles(key: RequiredDocumentKey, added: VisaDocFile[]) {
    if (!data) return
    const existing = data.documentFiles?.[key] || []
    update({
      documentFiles: { ...data.documentFiles, [key]: [...existing, ...added] },
      // Holding the file is stronger evidence than ticking the box, so the
      // tick follows the upload rather than the student having to do both.
      documentsChecked: { ...data.documentsChecked, [key]: true },
    })
  }

  function removeFile(key: RequiredDocumentKey, filename: string) {
    if (!data) return
    const remaining = (data.documentFiles?.[key] || []).filter((f) => f.filename !== filename)
    update({ documentFiles: { ...data.documentFiles, [key]: remaining } })
  }

  /**
   * The checklist, per visa class.
   *
   * It used to be one flat list that named an I-20, a SEVIS receipt and an
   * admission letter for everybody - which is the F-1 list, handed to visitors
   * and H-1B applicants as though it were theirs. What each class actually
   * brings comes from the same definition the intake collects against, so the
   * two can never drift apart.
   */
  const checklist = useMemo(
    () => [
      ...documentsFor(visaType).map((spec) => ({ key: spec.kind as RequiredDocumentKey, labelKey: spec.labelKey })),
      ...APPOINTMENT_DOCUMENTS.map((key) => ({ key: key as RequiredDocumentKey, labelKey: `visaPrep.documents.${key}` })),
    ],
    [visaType],
  )

  if (!data) return null

  const checkedCount = checklist.filter((item) => data.documentsChecked[item.key]).length

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-primary">{t('visaPrep.documentsTitle')}</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {checkedCount} / {checklist.length}
          </span>
        </div>
        {/* Packing for an interview is the one place a bar earns its keep -
            the student wants to know at a glance whether they are ready. */}
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }}
          />
        </div>
        <div className="space-y-1">
          {checklist.map(({ key, labelKey }) => {
            const attached = data.documentFiles?.[key] || []
            return (
              <div key={key} className="rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
                {/* The upload control sits outside the label on purpose - inside
                    one, clicking "attach" would toggle the checkbox too. */}
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!data.documentsChecked[key]}
                    onChange={() => toggleDoc(key)}
                    className="h-4 w-4 rounded accent-primary shrink-0"
                  />
                  <span className="text-sm text-foreground">{t(labelKey)}</span>
                </label>
                <div className="pl-7">
                  <VisaDocumentUpload
                    userId={userId}
                    docKey={key}
                    files={attached}
                    onUploaded={(added) => addFiles(key, added)}
                    onRemove={(filename) => removeFile(key, filename)}
                  />
                </div>
              </div>
            )
          })}
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
