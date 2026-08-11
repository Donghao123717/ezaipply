import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { WritingWorkspace } from '@/components/writing/writing-workspace'

export const dynamic = 'force-dynamic'

export default async function WritingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <WritingWorkspace userId={user.id as string} />
    </AppLayout>
  )
}
