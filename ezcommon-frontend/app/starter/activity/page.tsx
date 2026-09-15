import { requireSession } from '@/lib/require-session'
import { AppLayout } from '@/components/layout/app-layout'
import { SectionFilePreview } from '@/components/starter/section-file-preview'

export const dynamic = 'force-dynamic'

export default async function StarterActivityIndex() {
  await requireSession()

  return (
    <AppLayout>
      <SectionFilePreview
        section="activity"
        title="Activity Documents"
        description="View and manage your extracurricular activities, awards, and achievement documents."
      />
    </AppLayout>
  )
}

