"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollegeCategory, SavedCollege } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import { computeApplicationProgress, STATUS_LABEL_KEY } from '@/lib/application-status'
import { SCHOOL_ADMISSIONS_DATA } from '@/lib/school-admissions-data'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useT } from '@/lib/i18n/use-t'

const CATEGORY_ORDER: CollegeCategory[] = ['reach', 'target', 'safety']

type SortMode = 'category' | 'deadline' | 'name'

export function YourSchools({
  userId,
  colleges,
  onRemove,
  onChangeCategory,
}: {
  userId: string
  colleges: SavedCollege[]
  onRemove: (id: string) => void
  onChangeCategory: (id: string, category: CollegeCategory) => void
}) {
  const t = useT()
  const [sortMode, setSortMode] = useState<SortMode>('category')
  const [ready, setReady] = useState(false)

  // computeApplicationProgress reads localStorage, so wait for client mount
  useEffect(() => setReady(true), [])

  const grouped = useMemo(() => {
    if (sortMode !== 'category') return null
    const groups = new Map<CollegeCategory, SavedCollege[]>()
    for (const cat of CATEGORY_ORDER) groups.set(cat, [])
    for (const college of colleges) groups.get(college.category)!.push(college)
    return groups
  }, [colleges, sortMode])

  const flatSorted = useMemo(() => {
    if (sortMode === 'category') return null
    const copy = [...colleges]
    if (sortMode === 'name') copy.sort((a, b) => a.name.localeCompare(b.name))
    if (sortMode === 'deadline') {
      copy.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline < b.deadline ? -1 : 1
      })
    }
    return copy
  }, [colleges, sortMode])

  function renderCard(college: SavedCollege) {
    const progress = ready ? computeApplicationProgress(userId, college.id) : null
    const admissions = SCHOOL_ADMISSIONS_DATA[college.name]
    return (
      <div key={college.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-primary truncate">{college.name}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Select value={college.category} onValueChange={(value) => onChangeCategory(college.id, value as CollegeCategory)}>
              <SelectTrigger className="w-auto h-auto gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100">
                {t(CATEGORY_LABEL_KEY[college.category])}
              </SelectTrigger>
              <SelectContent align="start">
                {CATEGORY_ORDER.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(CATEGORY_LABEL_KEY[cat])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {progress ? t(STATUS_LABEL_KEY[progress.status]) : t('common.status.notStarted')}
            </span>
            <span className="text-xs text-muted-foreground">
              {college.deadline
                ? new Date(college.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : t('colleges.yourSchools.noDeadline')}
            </span>
            {admissions && (
              <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                {admissions.acceptanceRate}% · {admissions.testBlind ? t('colleges.requirements.testBlind') : admissions.satRange ? `SAT ${admissions.satRange[0]}-${admissions.satRange[1]}` : t('colleges.requirements.notPublished')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Link
              href={`/colleges/${college.id}`}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {t('colleges.yourSchools.openApplication')}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => onRemove(college.id)}
              className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <X className="h-3 w-3" />
              {t('colleges.yourSchools.remove')}
            </button>
          </div>
        </div>
        <div className="shrink-0 text-center">
          <div className="h-14 w-14 rounded-full border-2 border-muted flex items-center justify-center">
            <span className="text-[9px] font-medium text-muted-foreground leading-tight uppercase">
              {progress ? `${progress.percent}%` : '—'}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{t('colleges.yourSchools.completion')}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colleges.yourSchools.eyebrow')}</p>
          <h2 className="font-semibold text-primary">{t('colleges.yourSchools.title')}</h2>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">{t('colleges.yourSchools.sortBy')}</span>
          {(['category', 'deadline', 'name'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={cn(
                'rounded-full px-2.5 py-1 font-medium',
                sortMode === mode ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted',
              )}
            >
              {mode === 'category'
                ? t('colleges.yourSchools.sortCategory')
                : mode === 'deadline'
                  ? t('colleges.yourSchools.sortDeadline')
                  : t('colleges.yourSchools.sortName')}
            </button>
          ))}
        </div>
      </div>

      {colleges.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('colleges.yourSchools.empty')}
        </div>
      ) : sortMode === 'category' && grouped ? (
        <div className="space-y-4">
          {CATEGORY_ORDER.filter((cat) => grouped.get(cat)!.length > 0).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <p className="font-semibold text-primary">{t(CATEGORY_LABEL_KEY[cat])}</p>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                  {grouped.get(cat)!.length}
                </span>
              </div>
              <div className="space-y-2">{grouped.get(cat)!.map(renderCard)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{flatSorted?.map(renderCard)}</div>
      )}
    </div>
  )
}
