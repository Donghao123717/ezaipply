import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { ForecastWorkspace } from '@/components/forecast/forecast-workspace'

export const dynamic = 'force-dynamic'

export default async function ForecastPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <ForecastWorkspace userId={user.id as string} />
    </AppLayout>
  )
}
