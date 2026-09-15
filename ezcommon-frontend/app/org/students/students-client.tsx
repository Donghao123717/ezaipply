"use client"
import Link from 'next/link'
import { useT } from '@/lib/i18n/use-t'

export interface OrgStudent {
  id: string
  email?: string
  first_name?: string
  last_name?: string
}

export function OrgStudentsClient({ students, hasOrg }: { students: OrgStudent[]; hasOrg: boolean }) {
  const t = useT()

  if (!hasOrg) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{t('org.noOrg')}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('org.studentsTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('org.studentsBlurb')}</p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('org.noStudents')}</p>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          {students.map((s) => {
            const fullName = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{fullName || s.email || t('org.student')}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{s.id}</span>
                    {s.email && <span className="ml-2">{s.email}</span>}
                  </div>
                </div>
                <Link
                  href={`/org/students/${encodeURIComponent(s.id)}`}
                  className="text-xs text-primary hover:underline"
                >
                  {t('org.viewDetails')}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
