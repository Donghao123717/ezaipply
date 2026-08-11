import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AppLayout } from '@/components/layout/app-layout'
import { ApplicationWorkspace } from '@/components/application-form/application-workspace'

export const dynamic = 'force-dynamic'

export default async function ApplicationFormPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const { id } = await params
  const user: any = session.user || {}

  return (
    <AppLayout>
      <ApplicationWorkspace userId={user.id as string} collegeId={id} />
    </AppLayout>
  )
}
