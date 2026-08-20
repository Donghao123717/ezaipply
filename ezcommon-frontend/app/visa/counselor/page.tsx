import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { VisaCounselor } from '@/components/visa/visa-counselor'

export const dynamic = 'force-dynamic'

export default async function VisaCounselorPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}

  return (
    <AppLayout>
      <VisaCounselor userId={user.id as string} />
    </AppLayout>
  )
}
