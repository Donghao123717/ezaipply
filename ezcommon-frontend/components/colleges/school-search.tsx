"use client"
import { useMemo, useState } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { COLLEGES_DATABASE } from '@/lib/colleges-database'
import type { CollegeCategory } from '@/lib/college-store'
import { CATEGORY_LABEL_KEY } from '@/lib/college-store'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useT } from '@/lib/i18n/use-t'

export function SchoolSearch({
  savedNames,
  onAdd,
}: {
  savedNames: Set<string>
  onAdd: (name: string, category: CollegeCategory) => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [sortDesc, setSortDesc] = useState(false)

  const results = useMemo(() => {
    const filtered = COLLEGES_DATABASE.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    const sorted = [...filtered].sort((a, b) => (sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)))
    return sorted
  }, [query, sortDesc])

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('colleges.search.eyebrow')}</p>
      <h2 className="font-semibold text-primary flex items-center gap-1.5 mb-1">
        <GraduationCap className="h-4 w-4" />
        {t('colleges.search.title')}
      </h2>
      <p className="text-sm text-muted-foreground mb-3">{t('colleges.search.subtitle')}</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('colleges.search.placeholder')}
        className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-primary mb-3"
      />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{t('colleges.search.resultsCount').replace('{count}', String(results.length))}</span>
        <button
          onClick={() => setSortDesc((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {sortDesc ? t('colleges.search.sortZA') : t('colleges.search.sortAZ')}
        </button>
      </div>

      <div className="max-h-[520px] overflow-y-auto space-y-1 pr-1">
        {results.map((school) => {
          const alreadySaved = savedNames.has(school.name)
          return (
            <div
              key={school.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate">{school.name}</p>
                <p className="text-xs text-muted-foreground">{t('colleges.search.code').replace('{code}', school.code)}</p>
              </div>
              {alreadySaved ? (
                <span className="text-xs text-muted-foreground shrink-0">{t('colleges.search.added')}</span>
              ) : (
                <Select onValueChange={(value) => onAdd(school.name, value as CollegeCategory)}>
                  <SelectTrigger className="w-auto h-auto shrink-0 gap-1 rounded-full border-none bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100">
                    <span className="flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      {t(CATEGORY_LABEL_KEY.target)}
                    </span>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(['reach', 'target', 'safety'] as CollegeCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {t(CATEGORY_LABEL_KEY[cat])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
