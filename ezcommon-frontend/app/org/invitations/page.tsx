"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n/use-t'

interface Invitation {
  org_id: string
  student_id: string
  status: string
  created_at?: string
  updated_at?: string
  org_name?: string
  message?: string
}

interface StudentSummary {
  id: string
  email?: string
  first_name?: string
  last_name?: string
}

const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'

export default function OrgInvitationsPage() {
  const t = useT()
  const { data: session } = useSession()
  const orgId = (session?.user as any)?.orgId as string | undefined
  const orgUserId = (session?.user as any)?.id as string | undefined

  const [loadingInvites, setLoadingInvites] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<StudentSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    const loadInvites = async () => {
      try {
        setLoadingInvites(true)
        const res = await fetch(`${backendBase}/api/org/invitations?org_id=${encodeURIComponent(orgId)}`)
        if (!res.ok) throw new Error(t('org.loadInvitationsFailed'))
        const data = await res.json()
        const items = (data as any)?.items ?? []
        setInvitations(Array.isArray(items) ? items : [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingInvites(false)
      }
    }
    loadInvites()
  }, [orgId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    try {
      setError(null)
      setSearching(true)
      const res = await fetch(
        `${backendBase}/api/org/students/search?query=${encodeURIComponent(searchQuery.trim())}`,
      )
      if (!res.ok) throw new Error(t('org.searchFailed'))
      const data = await res.json()
      const users = (data as any)?.users ?? (data as any)?.items ?? []
      setSearchResults(Array.isArray(users) ? users : [])
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : t('org.searchFailed'))
    } finally {
      setSearching(false)
    }
  }

  const handleInvite = async (student: StudentSummary) => {
    if (!orgId || !student.id) return
    try {
      setError(null)
      const res = await fetch(`${backendBase}/api/org/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          student_id: student.id,
          created_by_user_id: orgUserId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any)?.detail || t('org.inviteFailed'))
      }
      // Refresh invitations list
      const listRes = await fetch(
        `${backendBase}/api/org/invitations?org_id=${encodeURIComponent(orgId)}`,
      )
      if (listRes.ok) {
        const listData = await listRes.json()
        const items = (listData as any)?.items ?? []
        setInvitations(Array.isArray(items) ? items : [])
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : t('org.inviteFailed'))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('org.invitationsTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('org.invitationsIntro')}</p>
      </div>

      {!orgId && (
        <p className="text-sm text-destructive">{t('org.missingOrgId')}</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="search">{t('org.searchStudents')}</Label>
            <Input
              id="search"
              placeholder={t('org.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={searching || !searchQuery.trim()}>
            {searching ? t('org.searching') : t('org.search')}
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="border rounded-lg divide-y bg-card">
            {searchResults.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {s.first_name || s.last_name ? `${s.first_name ?? ''} ${s.last_name ?? ''}` : s.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{s.id}</span>
                    {s.email && <span className="ml-2">{s.email}</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleInvite(s)}>
                  {t('org.invite')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('org.existingInvitations')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('org.invitationsBlurb')}
          </p>
        </div>

        {loadingInvites ? (
          <p className="text-sm text-muted-foreground">{t('org.loadingInvitations')}</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('org.noInvitations')}</p>
        ) : (
          <div className="border rounded-lg divide-y bg-card">
            {invitations.map((inv) => (
              <div
                key={`${inv.org_id}:${inv.student_id}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {t('org.studentId')}: <span className="font-mono">{inv.student_id}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('org.status')}: {inv.status}
                    {inv.created_at && <span className="ml-2">{t('org.created')}: {inv.created_at}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

