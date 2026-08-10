import { AppLayout } from '@/components/layout/app-layout'
import { ParsePageClient } from '@/components/parse/parse-page-client'

interface ParsePageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ParsePage({ searchParams }: ParsePageProps) {
  const resolvedSearchParams = await searchParams
  const userIdParam = resolvedSearchParams?.user_id
  const userIdOverride = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam

  return (
    <AppLayout>
      <ParsePageClient userIdOverride={userIdOverride} />
    </AppLayout>
  )
}

