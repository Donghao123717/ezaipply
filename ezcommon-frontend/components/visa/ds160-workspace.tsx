"use client"
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DS160_SECTIONS, F1_ONLY_SECTIONS, isProfileSectionComplete } from '@/lib/ds160-schema'
import { loadDS160Data, saveDS160Data, type Ds160Data } from '@/lib/ds160-store'
import { PROFILE_SECTIONS } from '@/lib/profile-schema'
import { FieldInput } from '@/components/profile/field-input'
import { ProfilePullPage } from '@/components/application-form/profile-pull-page'
import { RiskFlagsPanel } from '@/components/visa/risk-flags-panel'
import { Ds160SuggestionsPanel } from '@/components/visa/ds160-suggestions-panel'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/use-t'

type SimpleData = Record<string, any>

function nestedList(sectionData: any, nestedKey: string): Record<string, string>[] {
  return Array.isArray(sectionData?.[nestedKey]) ? sectionData[nestedKey] : []
}

const FAMILY_PAGE_KEY = 'familyInfo'
const NO_RISK_CHECK_PAGES = ['setup', 'photo']
const SECURITY_SECTIONS = ['security1', 'security2', 'security3', 'security4', 'security5']
/** Yes/No fields that default to "No" the same way security questions do - most
 * applicants genuinely answer No to these. hasTraveledLast5Years is excluded since
 * it varies a lot student to student and feeds the countriesVisited list below it. */
const DEFAULT_NO_SECTIONS: Record<string, string[]> = {
  additionalWork: ['belongsToClanOrTribe', 'hasOrgMembership', 'hasSpecializedSkills', 'hasMilitaryService', 'hasParamilitaryInvolvement'],
}

export function Ds160Workspace({ userId }: { userId: string }) {
  const t = useT()
  const [data, setData] = useState<Ds160Data>({})
  const [profileData, setProfileData] = useState<Record<string, any>>({})
  const [activeKey, setActiveKey] = useState<string>(DS160_SECTIONS[0].key)
  const [hydrated, setHydrated] = useState(false)
  const [mode, setMode] = useState<'fill' | 'confirm'>('fill')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  useEffect(() => {
    // Security questions (and a few Additional Work/Education Yes/No questions)
    // default to "No" - the answer for the vast majority of applicants - so the
    // student reviews/corrects rather than filling dozens of Yes/No questions
    // from scratch. Never overwrites an answer already set.
    const loaded = loadDS160Data(userId)
    for (const section of DS160_SECTIONS) {
      if (section.def.kind !== 'simple') continue
      const isSecurity = SECURITY_SECTIONS.includes(section.key)
      const defaultNoFields = DEFAULT_NO_SECTIONS[section.key]
      if (!isSecurity && !defaultNoFields) continue
      const sectionData = (loaded[section.key] as SimpleData) || {}
      let changed = false
      for (const field of section.def.groups.flatMap((g) => g.fields)) {
        const shouldDefault = isSecurity || defaultNoFields!.includes(field.key)
        if (shouldDefault && field.type === 'radio' && field.options?.includes('No') && sectionData[field.key] === undefined) {
          sectionData[field.key] = 'No'
          changed = true
        }
      }
      if (changed) loaded[section.key] = sectionData
    }
    setData(loaded)
    try {
      const raw = window.localStorage.getItem(`aipply-profile-${userId}`)
      setProfileData(raw ? JSON.parse(raw) : {})
    } catch {
      setProfileData({})
    }
    setHydrated(true)
  }, [userId])

  useEffect(() => {
    if (!hydrated) return
    saveDS160Data(userId, data)
  }, [data, hydrated, userId])

  const isF1Selected = useMemo(() => {
    const travel = data['travel'] as SimpleData | undefined
    const purposes = Array.isArray(travel?.tripPurposes) ? (travel!.tripPurposes as Record<string, string>[]) : []
    return purposes.some((p) => p.specify === 'STUDENT (F1)' || p.purposeClass === 'ACADEMIC OR LANGUAGE STUDENT (F)')
  }, [data])

  const pages = useMemo(
    () => DS160_SECTIONS.filter((s) => !F1_ONLY_SECTIONS.includes(s.key) || isF1Selected).map((s) => ({ key: s.key, labelKey: s.labelKey })),
    [isF1Selected],
  )

  // For an F1 applicant, the current school is trivially also "an educational
  // institution attended" - keep Previous Work/Education's schools list in sync
  // with Present Work/Education instead of asking the student to type it twice.
  const presentSchoolName = (data['presentWork'] as SimpleData)?.employerOrSchoolName || ''
  const presentStartDate = (data['presentWork'] as SimpleData)?.startDate || ''
  const sevisCourseOfStudy = (data['sevisSchool'] as SimpleData)?.courseOfStudy || ''
  useEffect(() => {
    if (!hydrated || !isF1Selected || !presentSchoolName) return
    setData((prev) => {
      const prevWork = (prev['previousWork'] as SimpleData) || {}
      const schools = nestedList(prevWork, 'schools')
      const synced = { schoolName: presentSchoolName, courseOfStudy: sevisCourseOfStudy, fromDate: presentStartDate, toDate: '' }
      const current = schools[0] || {}
      if (current.schoolName === synced.schoolName && current.fromDate === synced.fromDate && current.courseOfStudy === synced.courseOfStudy) {
        return prev
      }
      return {
        ...prev,
        previousWork: { ...prevWork, attendedSecondaryOrAbove: 'Yes', schools: [synced, ...schools.slice(1)] } as SimpleData,
      }
    })
  }, [hydrated, isF1Selected, presentSchoolName, presentStartDate, sevisCourseOfStudy])

  const confirmedMap: SimpleData = (data['_confirmed'] as SimpleData) || {}
  const isConfirmed = (key: string) => confirmedMap[key] === 'true'

  function updateSimpleField(sectionKey: string, fieldKey: string, value: string) {
    setData((prev) => ({ ...prev, [sectionKey]: { ...((prev[sectionKey] as SimpleData) || {}), [fieldKey]: value } }))
  }

  function addNestedItem(sectionKey: string, nestedKey: string) {
    setData((prev) => {
      const section = (prev[sectionKey] as SimpleData) || {}
      return { ...prev, [sectionKey]: { ...section, [nestedKey]: [...nestedList(section, nestedKey), {}] } }
    })
  }

  function updateNestedItem(sectionKey: string, nestedKey: string, index: number, fieldKey: string, value: string) {
    setData((prev) => {
      const section = (prev[sectionKey] as SimpleData) || {}
      const list = [...nestedList(section, nestedKey)]
      list[index] = { ...list[index], [fieldKey]: value }
      return { ...prev, [sectionKey]: { ...section, [nestedKey]: list } }
    })
  }

  function removeNestedItem(sectionKey: string, nestedKey: string, index: number) {
    setData((prev) => {
      const section = (prev[sectionKey] as SimpleData) || {}
      const list = [...nestedList(section, nestedKey)]
      list.splice(index, 1)
      return { ...prev, [sectionKey]: { ...section, [nestedKey]: list } }
    })
  }

  function applyDS160Suggestions(suggestions: { section: string; field: string; value: string; item?: number; nestedKey?: string }[]) {
    setData((prev) => {
      let next = prev

      for (const s of suggestions) {
        if (s.item === undefined) {
          next = { ...next, [s.section]: { ...((next[s.section] as SimpleData) || {}), [s.field]: s.value } }
        }
      }

      const groups = new Map<string, { section: string; nestedKey?: string; fields: Record<string, string> }>()
      for (const s of suggestions) {
        if (s.item === undefined) continue
        const groupKey = `${s.section} ${s.nestedKey || ''} ${s.item}`
        const group = groups.get(groupKey) || { section: s.section, nestedKey: s.nestedKey, fields: {} }
        const fieldKey = s.nestedKey && s.field.startsWith(`${s.nestedKey}.`) ? s.field.slice(s.nestedKey.length + 1) : s.field
        group.fields[fieldKey] = s.value
        groups.set(groupKey, group)
      }
      for (const { section, nestedKey, fields } of groups.values()) {
        if (nestedKey) {
          const sectionData = (next[section] as SimpleData) || {}
          next = { ...next, [section]: { ...sectionData, [nestedKey]: [...nestedList(sectionData, nestedKey), fields] } }
        } else {
          next = { ...next, [section]: [...(((next[section] as any[]) || [])), fields] }
        }
      }

      return next
    })
  }

  function markConfirmed(sectionKey: string) {
    setData((prev) => ({ ...prev, _confirmed: { ...((prev['_confirmed'] as SimpleData) || {}), [sectionKey]: 'true' } }))
    const idx = pages.findIndex((p) => p.key === sectionKey)
    const next = pages[idx + 1]
    setMode('fill')
    if (next) setActiveKey(next.key)
  }

  function fieldLabel(sectionKey: string, fieldKey: string): string {
    const section = PROFILE_SECTIONS.find((s) => s.key === sectionKey)
    if (!section) return fieldKey
    const fields = section.def.kind === 'simple' ? section.def.groups.flatMap((g) => g.fields) : section.def.fields
    return fields.find((f) => f.key === fieldKey)?.labelKey ? t(fields.find((f) => f.key === fieldKey)!.labelKey) : fieldKey
  }

  function profileSectionEntries(sectionKey: string): { label: string; value: string }[] {
    const value = profileData[sectionKey]
    if (!value) return []
    if (Array.isArray(value)) {
      return value
        .map((item: Record<string, string>, i: number) => ({
          label: `#${i + 1}`,
          value: Object.entries(item)
            .filter(([, v]) => v)
            .map(([k, v]) => `${fieldLabel(sectionKey, k)}: ${v}`)
            .join(' · '),
        }))
        .filter((e) => e.value)
    }
    return Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([k, v]) => ({ label: fieldLabel(sectionKey, k), value: v }))
  }

  const activeSection = DS160_SECTIONS.find((s) => s.key === activeKey)

  function ds160FieldLabel(sectionKey: string, fieldKey: string): string {
    const section = DS160_SECTIONS.find((s) => s.key === sectionKey)
    if (!section || section.def.kind !== 'simple') return fieldKey
    const fields = section.def.groups.flatMap((g) => g.fields)
    const field = fields.find((f) => f.key === fieldKey)
    return field ? t(field.labelKey) : fieldKey
  }

  function ds160SectionEntries(sectionKey: string): { label: string; value: string }[] {
    const value = data[sectionKey]
    if (!value || Array.isArray(value)) return []
    return Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
      .map(([k, v]) => ({ label: ds160FieldLabel(sectionKey, k), value: v }))
  }

  if (!hydrated) return null

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t('ds160.eyebrow')}</p>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('ds160.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('ds160.subtitle')}</p>
        </div>
        <Button onClick={() => setSuggestionsOpen(true)} className="shrink-0">
          <Sparkles className="h-4 w-4 mr-2" />
          {t('ds160.autofill.button')}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside>
          <nav className="space-y-1">
            {pages.map((p) => {
              const isActive = p.key === activeKey
              const complete = isConfirmed(p.key)
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    setActiveKey(p.key)
                    setMode('fill')
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                    isActive ? 'bg-secondary text-primary font-semibold' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <CheckCircle2 className={cn('h-4 w-4 shrink-0', complete ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                  <span className="truncate">{t(p.labelKey)}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          {activeSection && activeSection.def.kind === 'simple' ? (
            <div>
              <h2 className="text-xl font-semibold text-primary mb-6">{t(activeSection.labelKey)}</h2>

              {mode === 'fill' ? (
                <div className="space-y-8">
                  {activeKey === FAMILY_PAGE_KEY && (
                    <div className="pb-6 border-b">
                      <p className="text-sm text-muted-foreground mb-4">{t('ds160.familyInfo.subtitle')}</p>
                      <ProfilePullPage
                        sections={[{ key: 'family', label: t('profile.sections.family'), entries: profileSectionEntries('family') }]}
                      />
                    </div>
                  )}
                  {activeKey === 'photo' && <p className="text-sm text-muted-foreground">{t('ds160.photo.description')}</p>}
                  {activeSection.def.groups.map((group, gi) => (
                    <div key={gi} className={gi > 0 ? 'pt-6 border-t' : ''}>
                      {group.eyebrowKey && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t(group.eyebrowKey)}</p>
                      )}
                      {group.descriptionKey && <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">{t(group.descriptionKey)}</p>}
                      <div className="space-y-4">
                        {group.fields.map((field) => (
                          <FieldInput
                            key={field.key}
                            field={field}
                            value={(data[activeKey] as SimpleData)?.[field.key] || ''}
                            onChange={(v) => updateSimpleField(activeKey, field.key, v)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {(activeSection.def.nestedRepeatables || []).map((nested) => {
                    const list = nestedList(data[activeKey], nested.key)
                    return (
                      <div key={nested.key} className="pt-6 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(nested.labelKey)}</p>
                          {(!nested.maxItems || list.length < nested.maxItems) && (
                            <Button variant="outline" size="sm" onClick={() => addNestedItem(activeKey, nested.key)}>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {t(nested.itemLabelKey)}
                            </Button>
                          )}
                        </div>
                        {list.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t(nested.emptyLabelKey)}</p>
                        ) : (
                          <div className="space-y-4">
                            {list.map((item, index) => (
                              <div key={index} className="rounded-xl border p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-primary">#{index + 1}</p>
                                  <button
                                    onClick={() => removeNestedItem(activeKey, nested.key, index)}
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label={t('common.remove')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  {nested.fields.map((field) => (
                                    <FieldInput
                                      key={field.key}
                                      field={field}
                                      value={item[field.key] || ''}
                                      onChange={(v) => updateNestedItem(activeKey, nested.key, index, field.key, v)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => setMode('confirm')}
                      disabled={!isProfileSectionComplete(data[activeKey], activeSection.def)}
                    >
                      {t('ds160.reviewAndConfirm')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="h-4 w-4 text-accent" />
                    <p className="text-sm font-medium text-primary">{t('ds160.confirmStepTitle')}</p>
                  </div>
                  <div className="rounded-xl border divide-y mb-6">
                    {ds160SectionEntries(activeKey).map((entry, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">{entry.label}</span>
                        <span className="text-sm font-medium text-primary text-right">{entry.value}</span>
                      </div>
                    ))}
                  </div>

                  {!NO_RISK_CHECK_PAGES.includes(activeKey) && (
                    <RiskFlagsPanel userId={userId} section={activeKey} answers={(data[activeKey] as SimpleData) || {}} />
                  )}

                  <div className="flex items-center justify-between mt-6">
                    <Button variant="ghost" onClick={() => setMode('fill')}>
                      {t('ds160.backToEdit')}
                    </Button>
                    <Button onClick={() => markConfirmed(activeKey)}>
                      {t('ds160.confirmAndContinue')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {suggestionsOpen && (
        <Ds160SuggestionsPanel
          userId={userId}
          currentData={data}
          onApply={applyDS160Suggestions}
          onClose={() => setSuggestionsOpen(false)}
        />
      )}
    </div>
  )
}
