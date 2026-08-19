"use client"
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APPLICATION_PAGES } from '@/lib/application-schema'
import { loadApplication, saveApplication, type ApplicationAnswers } from '@/lib/application-store'
import { computeApplicationProgress } from '@/lib/application-status'
import { loadColleges, saveColleges, type SavedCollege } from '@/lib/college-store'
import { loadEssays, saveEssay, loadProfileContext } from '@/lib/essay-store'
import { getSchoolEssayTasks } from '@/lib/essay-tasks'
import { PROFILE_SECTIONS } from '@/lib/profile-schema'
import { FormHeader } from '@/components/application-form/form-header'
import { SubmitPluginBanner, AutofillSuggestionsBar } from '@/components/application-form/autofill-bar'
import { FieldPage } from '@/components/application-form/field-page'
import { ApplicationWritingPage } from '@/components/application-form/writing-page'
import { ProfilePullPage } from '@/components/application-form/profile-pull-page'
import { NotesPage } from '@/components/application-form/notes-page'
import { FormHelperChat } from '@/components/application-form/form-helper-chat'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

export function ApplicationWorkspace({ userId, collegeId }: { userId: string; collegeId: string }) {
  const t = useT()
  const [college, setCollege] = useState<SavedCollege | null | undefined>(undefined)
  const [activePage, setActivePage] = useState(APPLICATION_PAGES[0].key)
  const [answers, setAnswers] = useState<ApplicationAnswers>({})
  const [essays, setEssays] = useState(() => loadEssays(userId))
  const [profileData, setProfileData] = useState<Record<string, any>>({})
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null)
  const [generating, setGenerating] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const colleges = loadColleges(userId)
    setCollege(colleges.find((c) => c.id === collegeId) ?? null)
    setAnswers(loadApplication(userId, collegeId))
    setEssays(loadEssays(userId))
    try {
      const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
      setProfileData(raw ? JSON.parse(raw) : {})
    } catch {
      setProfileData({})
    }
  }, [userId, collegeId])

  const page = APPLICATION_PAGES.find((p) => p.key === activePage)!
  const progress = useMemo(() => computeApplicationProgress(userId, collegeId), [userId, collegeId, answers, essays])
  const essayTask = getSchoolEssayTasks([{ id: collegeId, name: college?.name || '' }], t)[0]

  function persistAnswers(next: ApplicationAnswers) {
    setAnswers(next)
    saveApplication(userId, collegeId, next)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1500)
  }

  function handleFieldChange(key: string, value: string) {
    persistAnswers({ ...answers, [key]: value })
    setSuggestions(null)
  }

  function handleEssayChange(html: string) {
    const record = { html, promptId: essays[essayTask.id]?.promptId || null, updatedAt: new Date().toISOString() }
    setEssays((prev) => ({ ...prev, [essayTask.id]: record }))
    saveEssay(userId, essayTask.id, record)
  }

  function handleSetDeadline(date: string) {
    const colleges = loadColleges(userId)
    const next = colleges.map((c) => (c.id === collegeId ? { ...c, deadline: date } : c))
    saveColleges(userId, next)
    setCollege((prev) => (prev ? { ...prev, deadline: date } : prev))
  }

  async function generateSuggestions() {
    if (page.kind !== 'fields' || !page.groups) return
    setGenerating(true)
    try {
      const fields = page.groups.flatMap((g) => g.fields).map((f) => ({
        key: f.key,
        label: t(f.labelKey),
        type: f.type,
        options: f.options || [],
      }))
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
      const res = await fetch(`${base}/api/application-form/autofill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: college?.name || '',
          fields,
          profile_context: loadProfileContext(userId),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Autofill failed')
      setSuggestions(data.suggestions || {})
    } catch {
      setSuggestions({})
    } finally {
      setGenerating(false)
    }
  }

  function applyAllSuggestions() {
    if (!suggestions) return
    persistAnswers({ ...answers, ...suggestions })
    setSuggestions(null)
  }

  function fieldLabel(sectionKey: string, fieldKey: string): string {
    const section = PROFILE_SECTIONS.find((s) => s.key === sectionKey)
    if (!section) return fieldKey
    const fields = section.def.kind === 'simple' ? section.def.groups.flatMap((g) => g.fields) : section.def.fields
    const field = fields.find((f) => f.key === fieldKey)
    return field ? t(field.labelKey) : fieldKey
  }

  function profileSectionEntries(sectionKey: string): { label: string; value: string }[] {
    const value = profileData[sectionKey]
    if (!value) return []
    if (Array.isArray(value)) {
      return value.map((item: Record<string, string>, i: number) => ({
        label: `#${i + 1}`,
        value: Object.entries(item)
          .filter(([, v]) => v)
          .map(([k, v]) => `${fieldLabel(sectionKey, k)}: ${v}`)
          .join(' · '),
      })).filter((e) => e.value)
    }
    // A simple section's data object may also hold nested repeatable arrays
    // (see NestedRepeatable) under other keys - only flat string fields make
    // sense in this read-only summary, so skip anything else.
    return Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([k, v]) => ({ label: fieldLabel(sectionKey, k), value: v }))
  }

  if (college === undefined) return null

  if (college === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-muted-foreground">{t('applicationForm.notOnListAnymore')}</p>
        <Button asChild className="mt-4">
          <a href="/colleges">{t('applicationForm.backToColleges')}</a>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <FormHeader
        schoolName={college.name}
        category={college.category}
        deadline={college.deadline || null}
        onSetDeadline={handleSetDeadline}
        progress={progress}
        saved={justSaved}
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <SubmitPluginBanner />
        {page.kind === 'fields' && (
          <AutofillSuggestionsBar
            loading={generating}
            hasSuggestions={!!suggestions && Object.keys(suggestions).length > 0}
            onGenerate={generateSuggestions}
            onApplyAll={applyAllSuggestions}
          />
        )}

        <div className="grid lg:grid-cols-[220px_1fr_340px] gap-6 mt-4 items-start">
          <aside>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('applicationForm.pagesLabel')}</p>
            <nav className="space-y-1">
              {APPLICATION_PAGES.map((p) => {
                const isActive = p.key === activePage
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setActivePage(p.key)
                      setSuggestions(null)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left',
                      isActive ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted',
                    )}
                  >
                    {t(p.labelKey)}
                    <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary-foreground/50' : 'text-muted-foreground/30')} />
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="rounded-2xl border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('applicationForm.eyebrow')}</p>
            <h2 className="text-xl font-semibold text-primary mb-1">{college.name}</h2>
            {page.kind === 'fields' && <p className="text-sm text-muted-foreground mb-6">{t('applicationForm.answerRequiredHint')}</p>}

            {page.kind === 'fields' && page.groups && (
              <FieldPage groups={page.groups} answers={answers} suggestions={suggestions} onChange={handleFieldChange} />
            )}
            {page.kind === 'writing' && (
              <ApplicationWritingPage userId={userId} task={essayTask} record={essays[essayTask.id]} onChange={handleEssayChange} />
            )}
            {page.kind === 'profile-pull' && (
              <ProfilePullPage
                sections={(page.profileSections || []).map((key) => {
                  const section = PROFILE_SECTIONS.find((s) => s.key === key)
                  return {
                    key,
                    label: section ? t(section.labelKey) : key,
                    entries: profileSectionEntries(key),
                  }
                })}
              />
            )}
            {page.kind === 'notes' && (
              <NotesPage value={answers.additionalNotes || ''} onChange={(v) => handleFieldChange('additionalNotes', v)} />
            )}

            {page.kind === 'fields' && (
              <div className="flex items-center gap-3 mt-6 pt-4 border-t">
                <Button size="sm" onClick={() => persistAnswers(answers)}>
                  {t('applicationForm.saveAnswers')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('applicationForm.autoSaveOn')}</span>
              </div>
            )}
          </div>

          <div className="h-[600px]">
            <FormHelperChat schoolName={college.name} />
          </div>
        </div>
      </div>
    </div>
  )
}
