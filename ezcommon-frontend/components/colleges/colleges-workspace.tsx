"use client"
import { useEffect, useMemo, useState } from 'react'
import { loadColleges, saveColleges, type CollegeCategory, type SavedCollege } from '@/lib/college-store'
import { COLLEGES_DATABASE } from '@/lib/colleges-database'
import { AtAGlance } from '@/components/colleges/at-a-glance'
import { YourSchools } from '@/components/colleges/your-schools'
import { SchoolSearch } from '@/components/colleges/school-search'

let idCounter = 0
function newId() {
  idCounter += 1
  return `saved-${Date.now()}-${idCounter}`
}

export function CollegesWorkspace({ userId }: { userId: string }) {
  const [colleges, setColleges] = useState<SavedCollege[]>([])

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

  function handleRemove(id: string) {
    persist(colleges.filter((c) => c.id !== id))
  }

  function handleChangeCategory(id: string, category: CollegeCategory) {
    persist(colleges.map((c) => (c.id === id ? { ...c, category } : c)))
  }

  const savedNames = useMemo(() => new Set(colleges.map((c) => c.name)), [colleges])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <AtAGlance userId={userId} colleges={colleges} />

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <YourSchools userId={userId} colleges={colleges} onRemove={handleRemove} onChangeCategory={handleChangeCategory} />
        <div className="rounded-2xl border bg-card p-5">
          <SchoolSearch savedNames={savedNames} onAdd={handleAdd} />
        </div>
      </div>
    </div>
  )
}
