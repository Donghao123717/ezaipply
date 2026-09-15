"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'
import { useLocale } from '@/lib/i18n/locale-context'
import {
  generateStudentProfile,
  hasProfileData,
  loadStudentProfile,
  profileFingerprint,
  type StudentProfileSummary,
} from '@/lib/student-profile-store'

/**
 * The counsellor's read on this student.
 *
 * The profile page lists every field they typed. This is the thing a form
 * cannot give them: what those fields add up to, and what is conspicuously
 * absent for the schools they are aiming at. The growth section is the reason
 * this exists - anyone can read a GPA back at you, and nobody tells a student
 * that their stated major has no evidence behind it.
 *
 * It builds itself. Nobody should have to press a button to find out what
 * their own counsellor thinks, and a card that only appears after you discover
 * the button mostly does not get read at all.
 *
 * It regenerates when the profile it was built from actually changes, not on
 * every page view - keyed on a fingerprint of the inputs. That keeps it current
 * without spending a model call every time the panel mounts, and means the
 * student can trust it still says what they read an hour ago unless they
 * changed something themselves.
 */

function Section({ title, items, tone }: { title: string; items: string[]; tone?: 'growth' }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 text-xs leading-relaxed text-foreground">
            <span className={tone === 'growth' ? 'text-accent' : 'text-primary/40'}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StudentProfileCard({ userId }: { userId: string }) {
  const t = useT()
  const { locale } = useLocale()
  const [summary, setSummary] = useState<StudentProfileSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // React mounts effects twice in development, and each build is a paid model
  // call - so the fingerprint already being in flight is enough to skip.
  const building = useRef<string | null>(null)

  const run = useCallback(async () => {
    const stamp = profileFingerprint(userId)
    if (building.current === stamp) return
    building.current = stamp
    setLoading(true)
    setError(null)
    try {
      setSummary(await generateStudentProfile(userId, locale))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('counselor.studentProfile.failed'))
      building.current = null
    } finally {
      setLoading(false)
    }
  }, [userId, locale, t])

  useEffect(() => {
    const cached = loadStudentProfile(userId)
    setSummary(cached)

    // Build it when there is something to read and no current read of it.
    // Stale means the profile changed since, not that time has passed.
    if (!hasProfileData(userId)) return
    const stale = !cached || cached.sourceHash !== profileFingerprint(userId)
    if (stale) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-sm font-semibold text-primary">{t('counselor.studentProfile.title')}</h3>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-accent/60 hover:text-primary disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {summary ? t('counselor.studentProfile.resync') : t('counselor.studentProfile.sync')}
        </button>
      </div>

      {!summary && !loading && (
        <p className="text-xs leading-relaxed text-muted-foreground">{t('counselor.studentProfile.noProfile')}</p>
      )}

      {loading && !summary && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('counselor.studentProfile.building')}
        </p>
      )}

      {summary && !summary.has_data && (
        <p className="text-xs leading-relaxed text-muted-foreground">{t('counselor.studentProfile.noProfile')}</p>
      )}

      {summary?.has_data && (
        <div className="space-y-3.5">
          {summary.verdict && (
            <div className="rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-xs italic leading-relaxed text-foreground">{summary.verdict}</p>
              <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('counselor.studentProfile.byline')}
              </p>
            </div>
          )}
          <Section title={t('counselor.studentProfile.academic')} items={summary.academic} />
          <Section title={t('counselor.studentProfile.strengths')} items={summary.strengths} />
          <Section title={t('counselor.studentProfile.activities')} items={summary.activities} />
          {/* Last and accented: it is the part they will act on. */}
          <Section title={t('counselor.studentProfile.growth')} items={summary.growth} tone="growth" />
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
