import { requireSession } from '@/lib/require-session'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireSession()
  return <SettingsClient />
}
