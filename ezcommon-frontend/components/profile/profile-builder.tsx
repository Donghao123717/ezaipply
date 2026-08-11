"use client"
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PROFILE_SECTIONS, isProfileSectionComplete, type FieldDef } from '@/lib/profile-schema'
import { FieldInput } from '@/components/profile/field-input'
import { SuggestionsPanel } from '@/components/profile/suggestions-panel'
import { useT } from '@/lib/i18n/use-t'

type SimpleData = Record<string, string>
type RepeatableData = Record<string, string>[]
type ProfileData = Record<string, SimpleData | RepeatableData>

function storageKey(userId: string) {
  return `aipply-profile-${userId}`
}

export function ProfileBuilder({ userId, defaultFirstName, defaultLastName }: { userId: string; defaultFirstName: string; defaultLastName: string }) {
  const t = useT()
  const [activeKey, setActiveKey] = useState(PROFILE_SECTIONS[0].key)
  // Render with sane defaults on first paint (server and client agree here);
  // saved localStorage data (client-only) is merged in right after mount.
  const [data, setData] = useState<ProfileData>({
    personal: { firstName: defaultFirstName, lastName: defaultLastName },
  })
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userId))
      if (raw) {
        const parsed: ProfileData = JSON.parse(raw)
        if (!parsed.personal) {
          parsed.personal = { firstName: defaultFirstName, lastName: defaultLastName }
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

          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            {t('profile.zeroFiles')}
            <span className="text-primary font-medium ml-1">{t('profile.manage')}</span>
          </div>
        </aside>

        <div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-primary mb-6">{t(activeMeta.labelKey)}</h2>

            {activeMeta.def.kind === 'simple' ? (
              <div className="space-y-8">
                {activeMeta.def.groups.map((group, gi) => (
                  <div key={gi} className={gi > 0 ? 'pt-6 border-t' : ''}>
                    {group.eyebrowKey && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t(group.eyebrowKey)}</p>
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
                ))}
              </div>
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

      {suggestionsOpen && <SuggestionsPanel userId={userId} onClose={() => setSuggestionsOpen(false)} />}
    </div>
  )
}
