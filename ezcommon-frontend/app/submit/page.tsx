import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { SubmitWorkspace } from '@/components/submit/submit-workspace'

export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}
  const firstName = (user.name || '').split(' ').filter(Boolean)[0] || ''

  return (
    <AppLayout>
      <SubmitWorkspace userId={user.id as string} firstName={firstName} />
    </AppLayout>
  )
}
