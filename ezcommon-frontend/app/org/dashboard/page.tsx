import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OrgDashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function OrgDashboardPage() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || {}
  return <OrgDashboardClient orgId={user.orgId ?? null} />
}
