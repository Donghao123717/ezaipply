"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/use-t'
import { loadColleges, saveColleges, type CollegeCategory, type SavedCollege } from '@/lib/college-store'
import { COLLEGES_DATABASE } from '@/lib/colleges-database'
import { AtAGlance } from '@/components/colleges/at-a-glance'
import { YourSchools } from '@/components/colleges/your-schools'
import { SchoolSearch } from '@/components/colleges/school-search'
import { RecommendedColleges } from '@/components/colleges/recommended-colleges'
import type { RecommendedCollege } from '@/lib/recommendation-store'

let idCounter = 0
function newId() {
  idCounter += 1
  return `saved-${Date.now()}-${idCounter}`
}

/**
 * Two jobs, two views.
 *
 * Finding schools and managing the ones already chosen are different tasks done
 * at different times, and stacking them on one page meant the list you had
 * built always sat below a block of suggestions you had already dealt with.
 * They are separate views now, and which one you are on lives in the URL, so
 * the home page and the profile page can send you straight to the one they mean.
 */
type CollegesView = 'recommend' | 'list'

export function CollegesWorkspace({ userId }: { userId: string }) {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [colleges, setColleges] = useState<SavedCollege[]>([])

  const view: CollegesView = params.get('view') === 'recommend' ? 'recommend' : 'list'
  const setView = useCallback(
    (next: CollegesView) => {
      // replace, not push - flipping a tab is not a step worth a back press.
      router.replace(next === 'recommend' ? '/colleges?view=recommend' : '/colleges', { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    setColleges(loadColleges(userId))
  }, [userId])

  function persist(next: SavedCollege[]) {
    setColleges(next)
    saveColleges(userId, next)
  }

  function handleAdd(name: string, category: CollegeCategory) {
    const dbEntry = COLLEGES_DATABASE.find((c) => c.name === name)
    persist([
      ...colleges,
      {
        id: newId(),
        name,
        category,
        addedAt: new Date().toISOString(),
        acceptanceRate: dbEntry?.acceptanceRate,
      },
    ])
  }

  function handleAcceptRecommendations(picks: RecommendedCollege[]) {
    const now = new Date().toISOString()
    persist([
      ...colleges,
      ...picks.map((pick) => ({
        id: newId(),
        name: pick.name,
        category: pick.category,
        addedAt: now,
        acceptanceRate: pick.acceptanceRate,
      })),
    ])
  }

  function handleRemove(id: string) {
    persist(colleges.filter((c) => c.id !== id))
  }

  function handleChangeCategory(id: string, category: CollegeCategory) {
    persist(colleges.map((c) => (c.id === id ? { ...c, category } : c)))
  }

  const savedNames = useMemo(() => new Set(colleges.map((c) => c.name)), [colleges])

  const tabs: { key: CollegesView; label: string; icon: typeof Sparkles; count?: number }[] = [
    { key: 'list', label: t('colleges.tabs.myList'), icon: GraduationCap, count: colleges.length },
    { key: 'recommend', label: t('colleges.tabs.recommended'), icon: Sparkles },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <nav className="mb-6 inline-flex rounded-full border bg-card p-1">
        {tabs.map((tab) => {
          const active = view === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-muted-foreground hover:text-primary',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    active ? 'text-primary-foreground/70' : 'text-muted-foreground/70',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {view === 'list' ? (
        <>
          <AtAGlance userId={userId} colleges={colleges} />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
            <YourSchools
              userId={userId}
              colleges={colleges}
              onRemove={handleRemove}
              onChangeCategory={handleChangeCategory}
            />
            <div className="rounded-2xl border bg-card p-5">
              <SchoolSearch savedNames={savedNames} onAdd={handleAdd} />
            </div>
          </div>
        </>
      ) : (
        <RecommendedColleges userId={userId} savedNames={savedNames} onAccept={handleAcceptRecommendations} />
      )}
    </div>
  )
}
