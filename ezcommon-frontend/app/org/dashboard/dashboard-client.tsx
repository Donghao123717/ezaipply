"use client"
import { useT } from '@/lib/i18n/use-t'

export function OrgDashboardClient({ orgId }: { orgId: string | null }) {
  const t = useT()
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('org.dashboardTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('org.dashboardBlurb')}</p>
      </div>

      {orgId && (
        <p className="text-sm text-muted-foreground">
          {t('org.organizationId')}: <span className="font-mono">{orgId}</span>
        </p>
      )}
    </div>
  )
}
