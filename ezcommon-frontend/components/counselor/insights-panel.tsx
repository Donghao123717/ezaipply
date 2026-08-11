"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Lock, Sparkles, TrendingUp, User } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'
import { computeProfileSectionsProgress } from '@/lib/profile-schema'
import { loadColleges, CATEGORY_LABEL_KEY, type SavedCollege } from '@/lib/college-store'
import { loadForecast, timeAgo, type ForecastRecord } from '@/lib/forecast-store'
import { ApplicationTrackerPanel } from '@/components/counselor/application-tracker'

const CATEGORY_CLASS: Record<SavedCollege['category'], string> = {
  reach: 'bg-rose-100 text-rose-700',
  target: 'bg-amber-100 text-amber-700',
  safety: 'bg-emerald-100 text-emerald-700',
}

function ProfileTab({ userId }: { userId: string }) {
  const t = useT()
  const [progress, setProgress] = useState<ReturnType<typeof computeProfileSectionsProgress> | null>(null)

  useEffect(() => {
    setProgress(computeProfileSectionsProgress(userId))
  }, [userId])

  if (!progress) return null
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const missing = progress.sections.filter((s) => !s.complete)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-primary text-sm">{t('counselor.profileTab.title')}</h3>
        <span className="text-xs font-semibold text-primary">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {missing.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">{t('counselor.profileTab.everyFilled')}</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('counselor.profileTab.stillMissing')}</p>
          {missing.map((s) => (
            <p key={s.key} className="text-sm text-foreground">
              {t(s.labelKey)}
            </p>
          ))}
        </div>
      )}
      <Button asChild size="sm" className="w-full">
        <Link href="/profile">{t('counselor.profileTab.openProfile')}</Link>
      </Button>
    </div>
  )
}

function SchoolsTab({ userId }: { userId: string }) {
  const t = useT()
  const [colleges, setColleges] = useState<SavedCollege[]>([])

  useEffect(() => {
    setColleges(loadColleges(userId))
  }, [userId])

  return (
    <div>
      <h3 className="font-semibold text-primary text-sm mb-3">{t('counselor.schoolsTab.title')}</h3>
      {colleges.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">{t('counselor.schoolsTab.empty')}</p>
      ) : (
        <div className="space-y-2 mb-4">
          {colleges.map((c) => (
            <div key={c.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-primary truncate">{c.name}</span>
                <span className={`text-[10px] font-semibold uppercase rounded-full px-1.5 py-0.5 shrink-0 ${CATEGORY_CLASS[c.category]}`}>
                  {t(CATEGORY_LABEL_KEY[c.category])}
                </span>
              </div>
              {c.deadline && <p className="text-xs text-muted-foreground mt-0.5">{t('counselor.schoolsTab.due').replace('{date}', c.deadline)}</p>}
            </div>
          ))}
        </div>
      )}
      <Button asChild size="sm" className="w-full">
        <Link href="/colleges">{t('counselor.schoolsTab.openColleges')}</Link>
      </Button>
    </div>
  )
}

function ForecastTab({ userId }: { userId: string }) {
  const t = useT()
  const [forecast, setForecast] = useState<ForecastRecord | null>(null)

  useEffect(() => {
    setForecast(loadForecast(userId))
  }, [userId])

  const avgChance =
    forecast && forecast.schools.length > 0
      ? Math.round(forecast.schools.reduce((sum, s) => sum + s.chance, 0) / forecast.schools.length)
      : null

  return (
    <div>
      <h3 className="font-semibold text-primary text-sm mb-3">{t('counselor.forecastTab.title')}</h3>
      {!forecast ? (
        <p className="text-sm text-muted-foreground mb-4">{t('counselor.forecastTab.generateCta')}</p>
      ) : (
        <div className="rounded-lg border px-3 py-3 mb-4">
          <p className="text-2xl font-semibold text-primary">{avgChance}%</p>
          <p className="text-xs text-muted-foreground">{t('counselor.forecastTab.avgChance').replace('{count}', String(forecast.schools.length))}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('counselor.forecastTab.generated').replace('{time}', timeAgo(forecast.generatedAt))}</p>
        </div>
      )}
      <Button asChild size="sm" className="w-full">
        <Link href="/forecast">{t('counselor.forecastTab.openForecast')}</Link>
      </Button>
    </div>
  )
}

function PremiumTab() {
  const t = useT()
  return (
    <div className="rounded-xl border border-dashed p-4 text-center">
      <Sparkles className="h-6 w-6 text-accent mx-auto mb-2" />
      <p className="text-sm font-semibold text-primary">{t('counselor.premiumTab.title')}</p>
      <p className="text-xs text-muted-foreground mt-1 mb-3">{t('counselor.premiumTab.description')}</p>
      <Button size="sm" variant="outline" disabled className="w-full">
        {t('counselor.premiumTab.comingSoon')}
      </Button>
    </div>
  )
}

export function InsightsPanel({ userId, onQuickAsk }: { userId: string; onQuickAsk: (text: string) => void }) {
  const t = useT()
  return (
    <aside className="w-96 shrink-0 border-l bg-card/50 h-full overflow-y-auto">
      <Tabs defaultValue="progress" className="p-4">
        <TabsList className="grid grid-cols-3 gap-1 bg-muted/60 h-auto mb-1">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs py-1.5">
            <User className="h-3.5 w-3.5" />
            {t('counselor.tabs.profile')}
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-1.5 text-xs py-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('counselor.tabs.progress')}
          </TabsTrigger>
          <TabsTrigger value="schools" className="flex items-center gap-1.5 text-xs py-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            {t('counselor.tabs.schools')}
          </TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-2 gap-1 bg-muted/60 h-auto mb-4">
          <TabsTrigger value="forecast" className="flex items-center gap-1.5 text-xs py-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('counselor.tabs.forecast')}
          </TabsTrigger>
          <TabsTrigger value="premium" className="flex items-center gap-1.5 text-xs py-1.5">
            <Lock className="h-3.5 w-3.5" />
            {t('counselor.tabs.premium')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab userId={userId} />
        </TabsContent>
        <TabsContent value="progress">
          <ApplicationTrackerPanel userId={userId} onQuickAsk={onQuickAsk} />
        </TabsContent>
        <TabsContent value="schools">
          <SchoolsTab userId={userId} />
        </TabsContent>
        <TabsContent value="forecast">
          <ForecastTab userId={userId} />
        </TabsContent>
        <TabsContent value="premium">
          <PremiumTab />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
