import { requireSession } from '@/lib/require-session'
import { AppLayout } from '@/components/layout/app-layout'
import { SectionFilePreview } from '@/components/starter/section-file-preview'

export const dynamic = 'force-dynamic'

export default async function StarterTestingIndex() {
  await requireSession()

  return (
    <AppLayout>
      <SectionFilePreview
        section="testing"
        title="Testing Documents"
        description="View and manage your standardized test scores, certificates, and related documents."
      />
    </AppLayout>
  )
}

