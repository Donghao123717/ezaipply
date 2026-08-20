import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { Ds160Workspace } from '@/components/visa/ds160-workspace'

export const dynamic = 'force-dynamic'

export default async function Ds160Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <Ds160Workspace userId={user.id as string} />
    </AppLayout>
  )
}
