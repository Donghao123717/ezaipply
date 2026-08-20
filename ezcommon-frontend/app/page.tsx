import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { HomeContent } from '@/components/home/home-content'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user: any = session.user || {}
  const role: string = user.role ?? 'student'

  // Organization users go to a separate dashboard experience
  if (role === 'org_admin' || role === 'org_staff') {
    redirect('/org/dashboard')
  }

  const name = user.name || user.email || 'there'
  const firstName = name.split(' ').filter(Boolean)[0] || 'there'

  return (
    <AppLayout>
      <HomeContent userId={user.id as string} firstName={firstName} />
    </AppLayout>
  )
}
