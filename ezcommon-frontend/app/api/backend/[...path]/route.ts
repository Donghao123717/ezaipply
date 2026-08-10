import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleMockBackend } from '@/lib/mock-backend'

type RouteContext = { params: Promise<{ path?: string[] }> }

async function proxy(request: NextRequest, context: RouteContext) {
  const resolvedParams = await context.params
  const pathSegments = resolvedParams.path || []

  // Demo build: large parts of the real Python/AWS backend's source were
  // stripped from this public repo, so by default every request is served
  // from an in-memory mock (lib/mock-backend.ts). If a real backend is ever
  // wired back up, set BACKEND_URL to route requests to it instead.
  if (process.env.BACKEND_URL) {
    return realProxy(request, context)
  }
  return handleMockBackend(pathSegments, request)
}

async function realProxy(request: NextRequest, context: RouteContext) {
  const resolvedParams = await context.params
  const path = (resolvedParams.path || []).join('/')
  const backendBase =
    process.env.BACKEND_URL ||
    request.nextUrl.origin || // fallback to same-origin if env missing
    'http://127.0.0.1:8000'
  const targetBase = backendBase.replace(/\/$/, '')
  const requestUrl = new URL(request.url)
  const search = requestUrl.search
  const targetUrl = `${path ? `${targetBase}/${path}` : targetBase}${search}`

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  try {
    const session = await getServerSession(authOptions)
    const accessToken = (session as any)?.accessToken
    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`)
    }
  } catch (e) {
    // ignore session fetch errors for proxy fallback
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : Buffer.from(await request.arrayBuffer())

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
