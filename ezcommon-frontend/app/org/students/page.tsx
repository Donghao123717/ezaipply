import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBackendBaseUrl } from '@/lib/server-fetch'
import { OrgStudentsClient, type OrgStudent } from './students-client'

export const dynamic = 'force-dynamic'

async function fetchOrgStudents(orgId: string): Promise<OrgStudent[]> {
  const base = await getBackendBaseUrl()
  try {
    const res = await fetch(
      `${base}/api/org/students?org_id=${encodeURIComponent(orgId)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) {
      console.error('Failed to fetch org students', await res.text())
      return []
    }
    const data = await res.json()
    const students = (data as any)?.students ?? []
    return Array.isArray(students) ? students : []
  } catch (e) {
    console.error('Error fetching org students', e)
    return []
  }
}

export default async function OrgStudentsPage() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || {}
  const orgId = (user.orgId as string | undefined) ?? undefined
  if (!orgId) return <OrgStudentsClient students={[]} hasOrg={false} />

  const students = await fetchOrgStudents(orgId)
  return <OrgStudentsClient students={students} hasOrg />
}
