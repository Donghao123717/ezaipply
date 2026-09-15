import { requireSession } from '@/lib/require-session'
import { InvitationsClient } from './invitations-client'

export const dynamic = 'force-dynamic'

export default async function StarterInvitationsPage() {
  await requireSession()
  return <InvitationsClient />
}
