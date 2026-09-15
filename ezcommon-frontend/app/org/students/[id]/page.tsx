import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBackendBaseUrl } from '@/lib/server-fetch'
import { StudentDetailClient, type StudentDetail } from './student-detail-client'

export const dynamic = 'force-dynamic'

async function fetchStudent(userId: string): Promise<StudentDetail | null> {
  const base = await getBackendBaseUrl()
  try {
    const res = await fetch(`${base}/api/auth/user/${encodeURIComponent(userId)}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('Failed to fetch student detail', await res.text())
      return null
    }
    const data = await res.json()
    return data as StudentDetail
  } catch (e) {
    console.error('Error fetching student detail', e)
    return null
  }
}

export default async function OrgStudentDetailPage({ params }: { params: any }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || {}
  const role: string = user.role ?? 'student'

  if (!session) redirect('/auth/login')
  if (role !== 'org_admin' && role !== 'org_staff') redirect('/')

  const resolvedParams = await (params as any)
  const studentIdRaw = resolvedParams?.id as string | undefined

  // Guard against an invalid route param, e.g. /org/students/undefined
  if (!studentIdRaw || studentIdRaw === 'undefined') redirect('/org/students')

  const student = await fetchStudent(decodeURIComponent(studentIdRaw))
  return <StudentDetailClient student={student} />
}
