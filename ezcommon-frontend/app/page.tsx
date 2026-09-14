import { LandingPage } from '@/components/landing/landing-page'

/**
 * The public landing page, shown whether or not someone is signed in - clicking
 * the Aipply wordmark should always bring you back here. Signed-in students
 * work out of /home instead.
 */
export default function RootPage() {
  return <LandingPage />
}
