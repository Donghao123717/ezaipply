import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { CounselorWorkspace } from '@/components/counselor/counselor-workspace'

export const dynamic = 'force-dynamic'

export default async function CounselorPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <CounselorWorkspace userId={user.id as string} />
    </AppLayout>
  )
}
