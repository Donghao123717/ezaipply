"use client"
import { BookOpen, GraduationCap, MessageSquare } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

interface RecentItem {
  key: string
  type: 'writing' | 'counselor' | 'colleges'
  subtitleKey?: string
  timeAgoKey: string
}

const icons = {
  writing: BookOpen,
  counselor: MessageSquare,
  colleges: GraduationCap,
}

const items: RecentItem[] = [
  { key: '1', type: 'writing', timeAgoKey: 'home.recent.time5d' },
  { key: '2', type: 'counselor', timeAgoKey: 'home.recent.time22d' },
  { key: '3', type: 'counselor', subtitleKey: 'home.recent.counselorQuestion', timeAgoKey: 'home.recent.time22d' },
  { key: '4', type: 'colleges', subtitleKey: 'home.recent.schoolBostonCollege', timeAgoKey: 'home.recent.time22d' },
  { key: '5', type: 'colleges', subtitleKey: 'home.recent.schoolDuke', timeAgoKey: 'home.recent.time22d' },
]

const typeTitleKey = {
  writing: 'nav.writing',
  counselor: 'nav.counselor',
  colleges: 'nav.colleges',
}

export function RecentWork() {
  const t = useT()
  return (
    <div>
      <h2 className="text-lg font-semibold text-primary mb-3">{t('home.recentWork')}</h2>
      <div className="rounded-xl border bg-card divide-y">
        {items.map((item) => {
          const Icon = icons[item.type]
          return (
            <div key={item.key} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-primary">{t(typeTitleKey[item.type])}</span>
                {item.subtitleKey && (
                  <span className="block text-xs text-muted-foreground truncate">{t(item.subtitleKey)}</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{t(item.timeAgoKey)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
