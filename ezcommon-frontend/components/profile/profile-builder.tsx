"use client"
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PROFILE_SECTIONS,
  isProfileSectionComplete,
  type FieldDef,
  type FieldGroup,
  type NestedRepeatable,
} from '@/lib/profile-schema'
import { FieldInput } from '@/components/profile/field-input'
import { SuggestionsPanel } from '@/components/profile/suggestions-panel'
import { FilesPanel } from '@/components/profile/files-panel'
import { useT } from '@/lib/i18n/use-t'

type SimpleData = Record<string, any>
type RepeatableData = Record<string, string>[]
type ProfileData = Record<string, SimpleData | RepeatableData>

function storageKey(userId: string) {
  return `aipply-profile-${userId}`
}

function nestedList(sectionData: any, nestedKey: string): Record<string, string>[] {
  return Array.isArray(sectionData?.[nestedKey]) ? sectionData[nestedKey] : []
}

export function ProfileBuilder({ userId, defaultFirstName, defaultLastName }: { userId: string; defaultFirstName: string; defaultLastName: string }) {
  const t = useT()
  const [activeKey, setActiveKey] = useState(PROFILE_SECTIONS[0].key)
  // Render with sane defaults on first paint (server and client agree here);
  // saved localStorage data (client-only) is merged in right after mount.
  const [data, setData] = useState<ProfileData>({
    'personal-info': { firstName: defaultFirstName, lastName: defaultLastName },
  })
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [additionalOpen, setAdditionalOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
    fetch(`${base}/api/upload/user/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setFileCount((d.files || []).length))
      .catch(() => setFileCount(0))
  }, [userId])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userId))
      if (raw) {
        const parsed: ProfileData = JSON.parse(raw)
        if (!parsed['personal-info']) {
          parsed['personal-info'] = { firstName: defaultFirstName, lastName: defaultLastName }
        }
        setData(parsed)
      }
    } catch {
      // ignore malformed local storage - defaults already in place
    } finally {
      setHydrated(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(storageKey(userId), JSON.stringify(data))
  }, [data, hydrated, userId])

  const activeMeta = useMemo(() => PROFILE_SECTIONS.find((s) => s.key === activeKey)!, [activeKey])

  const completeCount = PROFILE_SECTIONS.filter((s) => isProfileSectionComplete(data[s.key], s.def)).length
  const totalCount = PROFILE_SECTIONS.length
  const percent = Math.round((completeCount / totalCount) * 100)

  function updateSimpleField(sectionKey: string, fieldKey: string, value: string) {
    setData((prev) => ({
      ...prev,
      [sectionKey]: { ...((prev[sectionKey] as SimpleData) || {}), [fieldKey]: value },
    }))
  }

  function addRepeatableItem(sectionKey: string) {
    setData((prev) => ({
      ...prev,
      [sectionKey]: [...(((prev[sectionKey] as RepeatableData) || [])), {}],
    }))
  }

  function updateRepeatableItem(sectionKey: string, index: number, fieldKey: string, value: string) {
    setData((prev) => {
      const list = [...(((prev[sectionKey] as RepeatableData) || []))]
      list[index] = { ...list[index], [fieldKey]: value }
      return { ...prev, [sectionKey]: list }
    })
  }

  function removeRepeatableItem(sectionKey: string, index: number) {
    setData((prev) => {
      const list = [...(((prev[sectionKey] as RepeatableData) || []))]
      list.splice(index, 1)
      return { ...prev, [sectionKey]: list }
    })
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

  function applySuggestions(suggestions: { section: string; field: string; value: string }[]) {
    setData((prev) => {
      let next = prev
      for (const s of suggestions) {
        next = { ...next, [s.section]: { ...((next[s.section] as SimpleData) || {}), [s.field]: s.value } }
      }
      return next
    })
  }

  function renderGroup(group: FieldGroup, gi: number) {
    return (
      <div key={gi} className={gi > 0 ? 'pt-6 border-t' : ''}>
        {group.eyebrowKey && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t(group.eyebrowKey)}</p>
        )}
        {group.descriptionKey && (
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">{t(group.descriptionKey)}</p>
        )}
        <div className="grid sm:grid-cols-2 gap-5">
          {group.fields.map((field: FieldDef) => (
            <FieldInput
              key={field.key}
              field={field}
              value={(data[activeMeta.key] as SimpleData)?.[field.key] || ''}
              onChange={(v) => updateSimpleField(activeMeta.key, field.key, v)}
            />
          ))}
        </div>
      </div>
    )
  }

  function renderNestedRepeatable(nested: NestedRepeatable) {
    const list = nestedList(data[activeMeta.key], nested.key)
    const atMax = nested.maxItems != null && list.length >= nested.maxItems
    return (
      <div key={nested.key}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t(nested.labelKey)}</p>
        <div className="space-y-4">
          {list.length === 0 && <p className="text-sm text-muted-foreground">{t(nested.emptyLabelKey)}</p>}
          {list.map((item, index) => (
            <div key={index} className="rounded-xl border p-5 relative">
              <button
                aria-label={t('common.remove')}
                onClick={() => removeNestedItem(activeMeta.key, nested.key, index)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="grid sm:grid-cols-2 gap-5 pr-6">
                {nested.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={item[field.key] || ''}
                    onChange={(v) => updateNestedItem(activeMeta.key, nested.key, index, field.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => addNestedItem(activeMeta.key, nested.key)} disabled={atMax}>
            <Plus className="h-4 w-4 mr-2" />
            {t('common.add')} {t(nested.itemLabelKey)}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t('profile.eyebrow')}</p>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('profile.title')}</h1>
        </div>
        <Button onClick={() => setSuggestionsOpen(true)}>{t('profile.findSuggestions')}</Button>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside>
          <nav className="space-y-1">
            {PROFILE_SECTIONS.map((section) => {
              const complete = isProfileSectionComplete(data[section.key], section.def)
              const isActive = section.key === activeKey
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveKey(section.key)}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors',
                    isActive ? 'bg-secondary text-primary font-semibold' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <CheckCircle2 className={cn('h-4 w-4 shrink-0', complete ? 'text-emerald-500' : 'text-muted-foreground/30')} />
                  <span className="truncate">{t(section.labelKey)}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-6 pt-4 border-t">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('profile.sectionsComplete').replace('{done}', String(completeCount)).replace('{total}', String(totalCount)).replace('{percent}', String(percent))}
            </p>
          </div>

          <button
            onClick={() => setFilesOpen(true)}
            className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground w-full hover:text-primary"
          >
            <Paperclip className="h-4 w-4" />
            {t('profile.filesCount').replace('{count}', String(fileCount))}
            <span className="text-primary font-medium ml-1">{t('profile.manage')}</span>
          </button>
        </aside>

        <div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-primary mb-6">{t(activeMeta.labelKey)}</h2>

            {activeMeta.def.kind === 'simple' ? (
              (() => {
                const def = activeMeta.def
                const mainGroups = def.groups.filter((g) => !g.additional)
                const additionalGroups = def.groups.filter((g) => g.additional)
                const nestedRepeatables = def.nestedRepeatables || []
                const mainNested = nestedRepeatables.filter((n) => !n.additional)
                const additionalNested = nestedRepeatables.filter((n) => n.additional)
                const hasAdditional = additionalGroups.length > 0 || additionalNested.length > 0
                const isOpen = additionalOpen[activeMeta.key] ?? false
                return (
                  <div className="space-y-8">
                    {mainGroups.map(renderGroup)}
                    {mainNested.map(renderNestedRepeatable)}
                    {hasAdditional && (
                      <div className="rounded-xl border overflow-hidden">
                        <button
                          onClick={() => setAdditionalOpen((prev) => ({ ...prev, [activeMeta.key]: !isOpen }))}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40"
                        >
                          <div>
                            <p className="font-semibold text-primary">{t('profile.additionalInfoTitle')}</p>
                            {def.additionalInfoSubtitleKey && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t(def.additionalInfoSubtitleKey)}</p>
                            )}
                          </div>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-180')} />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 pt-2 border-t space-y-8">
                            {additionalGroups.map(renderGroup)}
                            {additionalNested.map(renderNestedRepeatable)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()
            ) : (
              <div className="space-y-4">
                {((data[activeMeta.key] as RepeatableData) || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t(activeMeta.def.emptyLabelKey)}</p>
                )}
                {((data[activeMeta.key] as RepeatableData) || []).map((item, index) => (
                  <div key={index} className="rounded-xl border p-5 relative">
                    <button
                      aria-label={t('common.remove')}
                      onClick={() => removeRepeatableItem(activeMeta.key, index)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid sm:grid-cols-2 gap-5 pr-6">
                      {(activeMeta.def as any).fields.map((field: FieldDef) => (
                        <FieldInput
                          key={field.key}
                          field={field}
                          value={item[field.key] || ''}
                          onChange={(v) => updateRepeatableItem(activeMeta.key, index, field.key, v)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => addRepeatableItem(activeMeta.key)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add')} {t((activeMeta.def as any).itemLabelKey)}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            {(() => {
              const idx = PROFILE_SECTIONS.findIndex((s) => s.key === activeKey)
              const next = PROFILE_SECTIONS[idx + 1]
              return next ? (
                <Button variant="ghost" className="ml-auto" onClick={() => setActiveKey(next.key)}>
                  {t('profile.next')}: {t(next.labelKey)}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <span />
              )
            })()}
          </div>
        </div>
      </div>

      {suggestionsOpen && (
        <SuggestionsPanel
          userId={userId}
          currentData={data as Record<string, Record<string, string> | undefined>}
          onApply={applySuggestions}
          onClose={() => setSuggestionsOpen(false)}
        />
      )}

      {filesOpen && (
        <FilesPanel userId={userId} onCountChange={setFileCount} onClose={() => setFilesOpen(false)} />
      )}
    </div>
  )
}
