"use client"
import { HomeGreeting } from '@/components/home/home-greeting'
import { Checklist, type ChecklistItem } from '@/components/home/checklist'
import { PromoCarousel } from '@/components/home/promo-carousel'
import { RecentWork } from '@/components/home/recent-work'
import { VisaHome } from '@/components/home/visa-home'
import { useMode } from '@/lib/app-mode'

const STUDY_CHECKLIST: ChecklistItem[] = [
  { key: 'profile', titleKey: 'home.profileTitle', subtitleKey: 'home.profileSubtitle', href: '/profile' },
  { key: 'writing', titleKey: 'home.writingTitle', subtitleKey: 'home.writingSubtitle', href: '/writing' },
  { key: 'colleges', titleKey: 'home.collegesTitle', subtitleKey: 'home.collegesSubtitle', href: '/colleges' },
  { key: 'forecast-submit', titleKey: 'home.forecastSubmitTitle', subtitleKey: 'home.forecastSubmitSubtitle', href: '/forecast' },
]

export function HomeContent({ userId, firstName }: { userId: string; firstName: string }) {
  const { mode } = useMode()

  if (mode === 'visa') {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <HomeGreeting firstName={firstName} />
        <div className="mt-8">
          <VisaHome userId={userId} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-10">
      <div className="space-y-8 min-w-0">
        <HomeGreeting firstName={firstName} />
        <Checklist items={STUDY_CHECKLIST} userId={userId} />
        <PromoCarousel initialIndex={2} />
      </div>
      <div>
        <RecentWork userId={userId} />
      </div>
    </div>
  )
}
