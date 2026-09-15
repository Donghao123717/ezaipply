"use client"
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AllFilesReview } from '@/components/starter/all-files-review'
import { useT } from '@/lib/i18n/use-t'

export interface StudentDetail {
  id: string
  email?: string
  first_name?: string
  last_name?: string
  role?: string
}

export function StudentDetailClient({ student }: { student: StudentDetail | null }) {
  const t = useT()

  if (!student) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{t('org.studentNotFound')}</p>
      </div>
    )
  }

  const fullName = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()

  return (
    <div className="p-6 space-y-4 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('org.studentDetails')}</h1>
        <p className="text-muted-foreground mt-1">{t('org.studentDetailsBlurb')}</p>
      </div>

      <div className="border rounded-lg bg-card p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('org.name')}</span>
          <span className="font-medium">{fullName || t('org.notAvailable')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('org.email')}</span>
          <span className="font-medium">{student.email || t('org.notAvailable')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('org.userId')}</span>
          <span className="font-mono text-xs">{student.id}</span>
        </div>
      </div>

      <div className="border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{t('org.applicationFiles')}</h2>
            <p className="text-xs text-muted-foreground">{t('org.filesBlurb')}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/parse?user_id=${encodeURIComponent(student.id)}`}>{t('org.helpWithAi')}</Link>
          </Button>
        </div>

        <div className="mt-2">
          <AllFilesReview userIdOverride={student.id} />
        </div>
      </div>
    </div>
  )
}
