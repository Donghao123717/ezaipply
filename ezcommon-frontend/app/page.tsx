import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { HomeGreeting } from '@/components/home/home-greeting'
import { Checklist, type ChecklistItem } from '@/components/home/checklist'
import { PromoCarousel } from '@/components/home/promo-carousel'
import { RecentWork } from '@/components/home/recent-work'

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

  const checklist: ChecklistItem[] = [
    { key: 'profile', titleKey: 'home.profileTitle', subtitleKey: 'home.profileSubtitle', href: '/profile' },
    { key: 'writing', titleKey: 'home.writingTitle', subtitleKey: 'home.writingSubtitle', href: '/writing' },
    { key: 'colleges', titleKey: 'home.collegesTitle', subtitleKey: 'home.collegesSubtitle', href: '/colleges' },
    { key: 'forecast-submit', titleKey: 'home.forecastSubmitTitle', subtitleKey: 'home.forecastSubmitSubtitle', href: '/forecast' },
  ]

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-8 min-w-0">
          <HomeGreeting firstName={firstName} />

          <Checklist items={checklist} userId={user.id as string} />

          <PromoCarousel initialIndex={2} />
        </div>

        <div>
          <RecentWork userId={user.id as string} />
        </div>
      </div>
    </AppLayout>
  )
}
