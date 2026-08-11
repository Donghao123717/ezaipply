import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { CollegesWorkspace } from '@/components/colleges/colleges-workspace'

export const dynamic = 'force-dynamic'

export default async function CollegesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <CollegesWorkspace userId={user.id as string} />
    </AppLayout>
  )
}
