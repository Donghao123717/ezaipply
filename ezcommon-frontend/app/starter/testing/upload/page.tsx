import { requireSession } from '@/lib/require-session'
import { AppLayout } from '@/components/layout/app-layout'
import { SectionUpload } from '@/components/starter/section-upload'
import { OnboardingSteps } from '@/components/starter/onboarding-steps'

export const dynamic = 'force-dynamic'

export default async function TestingUploadPage() {
  await requireSession()

  return (
    <AppLayout>
      <div className="p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-4">
          <OnboardingSteps current="testing" />
          <div className="border rounded-lg p-6 shadow-sm bg-card">
            <SectionUpload section="testing" />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

