import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { PrepTracker } from '@/components/visa/prep-tracker'

export const dynamic = 'force-dynamic'

export default async function VisaPrepPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <PrepTracker userId={user.id as string} />
    </AppLayout>
  )
}
