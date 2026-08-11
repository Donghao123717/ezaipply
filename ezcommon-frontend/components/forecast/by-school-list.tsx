"use client"
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { SavedCollege, CollegeCategory } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import type { SchoolForecast } from '@/lib/forecast-store'
import { useT } from '@/lib/i18n/use-t'

type SortMode = 'category' | 'top' | 'deadline' | 'change'

const CATEGORY_ORDER: CollegeCategory[] = ['reach', 'target', 'safety']

export function BySchoolList({
  colleges,
  forecasts,
  selectedId,
  onSelect,
}: {
  colleges: SavedCollege[]
  forecasts: Map<string, SchoolForecast>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const t = useT()
  const [sortMode, setSortMode] = useState<SortMode>('category')

  const grouped = useMemo(() => {
    if (sortMode !== 'category') return null
    const groups = new Map<CollegeCategory, SavedCollege[]>()
    for (const cat of CATEGORY_ORDER) groups.set(cat, [])
    for (const c of colleges) groups.get(c.category)!.push(c)
    return groups
  }, [colleges, sortMode])

  const flat = useMemo(() => {
    if (sortMode === 'category') return null
    const copy = [...colleges]
    if (sortMode === 'top') copy.sort((a, b) => (forecasts.get(b.id)?.chance || 0) - (forecasts.get(a.id)?.chance || 0))
    if (sortMode === 'deadline') {
      copy.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline < b.deadline ? -1 : 1
      })
    }
    if (sortMode === 'change') copy.sort((a, b) => a.name.localeCompare(b.name))
    return copy
  }, [colleges, forecasts, sortMode])

  function renderRow(college: SavedCollege) {
    const forecast = forecasts.get(college.id)
    const isSelected = college.id === selectedId
    return (
      <button
        key={college.id}
        onClick={() => onSelect(college.id)}
        className={cn(
          'w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors',
          isSelected ? 'bg-secondary' : 'hover:bg-muted',
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{college.name}</p>
          {forecast && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${forecast.chance}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-primary">{forecast ? `${forecast.chance}%` : '—'}</p>
          <p className="text-xs text-muted-foreground">
            {college.deadline ? new Date(college.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </p>
        </div>
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-primary">{t('forecast.bySchool.title')}</h2>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">{t('forecast.bySchool.sortBy')}</span>
          {([
            ['category', t('forecast.bySchool.sortCategory')],
            ['top', t('forecast.bySchool.sortTop')],
            ['deadline', t('forecast.bySchool.sortDeadline')],
            ['change', t('forecast.bySchool.sortChange')],
          ] as [SortMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={cn(
                'rounded-full px-2.5 py-1 font-medium',
                sortMode === mode ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-2">
        {colleges.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">{t('forecast.bySchool.empty')}</p>
        ) : sortMode === 'category' && grouped ? (
          <div className="space-y-3">
            {CATEGORY_ORDER.filter((cat) => grouped.get(cat)!.length > 0).map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-1">
                  {t(CATEGORY_LABEL_KEY[cat])} · {grouped.get(cat)!.length}
                </p>
                {grouped.get(cat)!.map(renderRow)}
              </div>
            ))}
          </div>
        ) : (
          <div>{flat?.map(renderRow)}</div>
        )}
      </div>
    </div>
  )
}
