import { NextRequest, NextResponse } from 'next/server'

// Demo build: the real Python/AWS backend (S3, DynamoDB, OpenSearch, LLM
// parsing) is not available - large parts of its source were stripped from
// this public repo. Everything below simulates just enough of its API
// surface, in memory, so the UI can be clicked through end to end without
// any external services.

export type Section = 'profile' | 'education' | 'activity' | 'testing'
const SECTIONS: Section[] = ['profile', 'education', 'activity', 'testing']

interface StoredFile {
  s3_key: string
  filename: string
  section: Section
  size: number
  content_type: string
  content: Buffer
  uploaded_at: string
}

interface Invitation {
  org_id: string
  student_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
  org_name?: string
}

const DEMO_STUDENT_ID = 'demo-student-1'
const DEMO_ORG_ID = 'demo-org'
const DEMO_ORG_ADMIN_ID = 'demo-org-admin-1'

const USERS: Record<string, { id: string; email: string; first_name: string; last_name: string; role: string; org_id: string | null; created_at: string }> = {
  [DEMO_STUDENT_ID]: {
    id: DEMO_STUDENT_ID,
    email: 'demo.student@aipply.app',
    first_name: 'Demo',
    last_name: 'Student',
    role: 'student',
    org_id: null,
    created_at: '2025-09-01T12:00:00Z',
  },
  [DEMO_ORG_ADMIN_ID]: {
    id: DEMO_ORG_ADMIN_ID,
    email: 'demo.advisor@aipply.app',
    first_name: 'Demo',
    last_name: 'Advisor',
    role: 'org_admin',
    org_id: DEMO_ORG_ID,
    created_at: '2025-09-01T12:00:00Z',
  },
}

const filesByUser = new Map<string, StoredFile[]>()
const invitations: Invitation[] = [
  {
    org_id: DEMO_ORG_ID,
    student_id: DEMO_STUDENT_ID,
    status: 'accepted',
    created_at: '2025-09-02T09:00:00Z',
    updated_at: '2025-09-03T10:00:00Z',
    org_name: 'Demo Advising Group',
  },
]

function seedText(title: string, body: string) {
  return `${title}\n${'='.repeat(title.length)}\n\n${body}\n\n(This is sample data generated for a product demo.)\n`
}

const SEED_FILES: Array<{ section: Section; filename: string; text: string }> = [
  {
    section: 'education',
    filename: 'Fall_2025_Transcript.txt',
    text: seedText(
      'DEMO HIGH SCHOOL — OFFICIAL TRANSCRIPT (SAMPLE)',
      [
        'Student: Demo Student',
        'Graduation Year: 2026',
        'Cumulative GPA: 3.85 / 4.0 (Unweighted)',
        '',
        'Grade 11 (2024-2025)',
        '  AP Calculus BC ........ A',
        '  AP Chemistry ........... A-',
        '  AP US History ........... B+',
        '  English 11 Honors ...... A',
        '  Spanish IV .............. A-',
        '',
        'Grade 10 (2023-2024)',
        '  Geometry Honors ........ A',
        '  Biology Honors .......... A',
        '  World History ........... A-',
      ].join('\n'),
    ),
  },
  {
    section: 'testing',
    filename: 'SAT_Score_Report.txt',
    text: seedText(
      'COLLEGE BOARD — SAT SCORE REPORT (SAMPLE)',
      ['Student: Demo Student', 'Test Date: March 2025', '', 'Total Score: 1480', '  Evidence-Based Reading & Writing: 730', '  Math: 750'].join('\n'),
    ),
  },
  {
    section: 'activity',
    filename: 'Volunteer_Certificate.txt',
    text: seedText(
      'CERTIFICATE OF SERVICE (SAMPLE)',
      ['Awarded to: Demo Student', 'Organization: Local Food Bank', 'Role: Team Lead', 'Hours: 200+', 'Period: 2023-2025'].join('\n'),
    ),
  },
  {
    section: 'profile',
    filename: 'Student_ID_Card.txt',
    text: seedText('SCHOOL ID (SAMPLE)', ['Name: Demo Student', 'DOB: 2008-04-12', 'School: Demo High School'].join('\n')),
  },
]

function ensureSeeded(userId: string) {
  if (filesByUser.has(userId)) return
  if (userId !== DEMO_STUDENT_ID) {
    filesByUser.set(userId, [])
    return
  }
  const now = new Date().toISOString()
  filesByUser.set(
    userId,
    SEED_FILES.map((f, idx) => ({
      s3_key: `${userId}/${f.section}/${f.filename}`,
      filename: f.filename,
      section: f.section,
      size: Buffer.byteLength(f.text),
      content_type: 'text/plain',
      content: Buffer.from(f.text, 'utf-8'),
      uploaded_at: new Date(Date.now() - (SEED_FILES.length - idx) * 86400000).toISOString(),
    })),
  )
}

function userFiles(userId: string): StoredFile[] {
  ensureSeeded(userId)
  return filesByUser.get(userId) || []
}

function toFileJson(f: StoredFile) {
  return {
    filename: f.filename,
    size: f.size,
    uploaded_at: f.uploaded_at,
    last_modified: f.uploaded_at,
    section: f.section,
    s3_key: f.s3_key,
    file_type: f.content_type,
  }
}

function fileUrl(userId: string, f: StoredFile) {
  return `/api/backend/api/upload/file-content?s3_key=${encodeURIComponent(f.s3_key)}&user_id=${encodeURIComponent(userId)}`
}

const CHUNK_LIBRARY: Record<Section, Array<{ category: string; information: string }>> = {
  education: [
    { category: 'Academic - GPA', information: 'Cumulative GPA: 3.85 / 4.0 (Unweighted)' },
    { category: 'Academic - Coursework', information: 'AP Calculus BC (A), AP Chemistry (A-), AP US History (B+), English 11 Honors (A), Spanish IV (A-)' },
    { category: 'School', information: 'Demo High School — Class of 2026' },
  ],
  testing: [
    { category: 'Standardized Test - SAT', information: 'Total 1480 (EBRW 730, Math 750) — March 2025' },
    { category: 'AP Exam Scores', information: 'AP Calculus BC: 5, AP Chemistry: 4, AP US History: 4' },
  ],
  activity: [
    { category: 'Volunteering', information: '200+ hours, Local Food Bank, Team Lead (2023-2025)' },
    { category: 'Leadership', information: 'President, Robotics Club (2024-2025); led team to regional finals' },
  ],
  profile: [
    { category: 'Personal Information', information: 'Full legal name, date of birth, and address verified from uploaded ID' },
  ],
}

function chatbotReply(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('gpa')) return "Based on your uploaded transcript, your cumulative GPA is 3.85/4.0. Want help figuring out how that compares to your target schools?"
  if (m.includes('sat') || m.includes('act') || m.includes('score')) return 'Your latest SAT score report shows a 1480 total (730 EBRW / 750 Math). I can help you decide whether to superscore or retake a section.'
  if (m.includes('essay')) return "I'd be happy to help brainstorm or review your essay. Paste a draft or tell me the prompt you're working on."
  if (m.includes('deadline') || m.includes('date')) return 'Most Early Decision/Early Action deadlines fall around November 1st, and Regular Decision is typically January 1st-15th. Check each school\'s site for exact dates.'
  return "This is a demo assistant with scripted answers (no live AI backend is connected). Try asking about your GPA, test scores, essays, or deadlines."
}

function json(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 })
}

async function readMultipartUserId(request: NextRequest): Promise<{ form: FormData; userId: string | null }> {
  const form = await request.formData()
  const userId = (form.get('user_id') as string) || null
  return { form, userId }
}

function sseFrame(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function handleParseStream(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams
  const s3Key = searchParams.get('s3_key') || ''
  const userId = searchParams.get('user_id') || ''
  const files = userFiles(userId)
  const file = files.find((f) => f.s3_key === s3Key)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const steps = [20, 55, 85]
      for (const p of steps) {
        controller.enqueue(encoder.encode(sseFrame({ progress: p, message: p < 50 ? 'Reading document…' : p < 80 ? 'Extracting structured fields…' : 'Finishing up…' })))
        await new Promise((r) => setTimeout(r, 350))
      }

      if (!file) {
        controller.enqueue(encoder.encode(sseFrame({ error: 'File not found' })))
        controller.close()
        return
      }

      const chunkDefs = CHUNK_LIBRARY[file.section] || []
      controller.enqueue(
        encoder.encode(
          sseFrame({
            result: {
              status: 'success',
              document_id: `doc_${file.s3_key}`,
              source_file: file.filename,
              s3_key: file.s3_key,
              section: file.section,
              file_type: file.content_type,
              chunks_created: chunkDefs.length,
              chunks: chunkDefs.map((c) => ({ text: c.information, category: c.category, chunk_type: 'extracted_field' })),
              processor_used: 'demo-mock',
              opensearch_stored: false,
            },
          }),
        ),
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export async function handleMockBackend(pathSegments: string[], request: NextRequest): Promise<Response> {
  const method = request.method
  const path = pathSegments.join('/')
  const searchParams = request.nextUrl.searchParams

  // --- File content (serves bytes for preview/download of demo files) ---
  if (path === 'api/upload/file-content' && method === 'GET') {
    const s3Key = searchParams.get('s3_key') || ''
    const userId = searchParams.get('user_id') || ''
    const file = userFiles(userId).find((f) => f.s3_key === s3Key)
    if (!file) return new Response('Not found', { status: 404 })
    return new Response(file.content, { headers: { 'Content-Type': file.content_type } })
  }

  // --- Per-section upload / list / delete ---
  const uploadSectionMatch = path.match(/^api\/upload\/(profile|education|activity|testing)$/)
  if (uploadSectionMatch) {
    const section = uploadSectionMatch[1] as Section
    if (method === 'POST') {
      const { form, userId } = await readMultipartUserId(request)
      if (!userId) return json({ error: 'user_id is required' }, 400)
      const list = userFiles(userId)
      const incoming = form.getAll('files').length ? form.getAll('files') : form.getAll('file')
      for (const entry of incoming) {
        if (entry instanceof File) {
          const buf = Buffer.from(await entry.arrayBuffer())
          list.push({
            s3_key: `${userId}/${section}/${Date.now()}_${entry.name}`,
            filename: entry.name,
            section,
            size: buf.length,
            content_type: entry.type || 'application/octet-stream',
            content: buf,
            uploaded_at: new Date().toISOString(),
          })
        }
      }
      return json({ status: 'ok', uploaded: incoming.length })
    }
    if (method === 'GET') {
      const userId = searchParams.get('user_id') || ''
      const files = userFiles(userId).filter((f) => f.section === section)
      return json({ files: files.map((f) => ({ ...toFileJson(f), url: fileUrl(userId, f) })) })
    }
  }

  const deleteByFilenameMatch = path.match(/^api\/upload\/(profile|education|activity|testing)\/(.+)$/)
  if (deleteByFilenameMatch && method === 'DELETE') {
    const [, section, filenameRaw] = deleteByFilenameMatch
    const filename = decodeURIComponent(filenameRaw)
    const userId = searchParams.get('user_id') || ''
    const list = userFiles(userId)
    const idx = list.findIndex((f) => f.section === section && f.filename === filename)
    if (idx >= 0) list.splice(idx, 1)
    return json({ status: 'ok' })
  }

  if (path === 'api/upload/file' && method === 'DELETE') {
    const s3Key = searchParams.get('s3_key') || ''
    const userId = searchParams.get('user_id') || ''
    const list = userFiles(userId)
    const idx = list.findIndex((f) => f.s3_key === s3Key)
    if (idx >= 0) list.splice(idx, 1)
    return json({ status: 'ok' })
  }

  const uploadUserMatch = path.match(/^api\/upload\/user\/(.+)$/)
  if (uploadUserMatch && method === 'GET') {
    const userId = decodeURIComponent(uploadUserMatch[1])
    const files = userFiles(userId)
    return json({ files: files.map((f) => ({ ...toFileJson(f), url: fileUrl(userId, f) })) })
  }

  // --- Voice transcription (treated as an activity-section upload) ---
  if (path === 'api/voice/transcribe' && method === 'POST') {
    const { form, userId } = await readMultipartUserId(request)
    if (!userId) return json({ error: 'user_id is required' }, 400)
    const section = ((form.get('section') as string) || 'activity') as Section
    const blob = form.get('file')
    const list = userFiles(userId)
    if (blob instanceof File) {
      const buf = Buffer.from(await blob.arrayBuffer())
      list.push({
        s3_key: `${userId}/${section}/${Date.now()}_voice_note.webm`,
        filename: 'voice_note.webm',
        section,
        size: buf.length,
        content_type: blob.type || 'audio/webm',
        content: buf,
        uploaded_at: new Date().toISOString(),
      })
    }
    return json({ status: 'ok', transcript: 'Voice note recorded (demo build does not run real transcription).' })
  }

  // --- User profile ---
  const userMatch = path.match(/^api\/user\/(.+)$/)
  if (userMatch && method === 'GET') {
    const userId = decodeURIComponent(userMatch[1])
    const user = USERS[userId]
    if (!user) return json({ error: 'User not found' }, 404)
    return json({ user })
  }

  const authUserMatch = path.match(/^api\/auth\/user\/(.+)$/)
  if (authUserMatch && method === 'GET') {
    const userId = decodeURIComponent(authUserMatch[1])
    const user = USERS[userId]
    if (!user) return json({ error: 'User not found' }, 404)
    return json(user)
  }

  // --- Document parser (list + SSE stream) ---
  if (path === 'api/parse/files' && method === 'GET') {
    const userId = searchParams.get('user_id') || ''
    const section = searchParams.get('section')
    const files = userFiles(userId).filter((f) => !section || f.section === section)
    return json(
      files.map((f) => ({
        key: f.s3_key,
        filename: f.filename,
        section: f.section,
        file_type: f.content_type,
        size: f.size,
        last_modified: f.uploaded_at,
        url: fileUrl(userId, f),
      })),
    )
  }

  if (path === 'api/parse/file/stream' && method === 'GET') {
    return handleParseStream(request)
  }

  // --- Intelligent extractor / form filler ---
  if (path === 'api/intelligent/files' && method === 'GET') {
    const userId = searchParams.get('user_id') || ''
    const section = searchParams.get('section')
    const files = userFiles(userId).filter((f) => !section || f.section === section)
    return json({ files: files.map((f) => ({ filename: f.filename, section: f.section, size: f.size, last_modified: f.uploaded_at })) })
  }

  if (path === 'api/intelligent/extract' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const requestedFiles: Array<{ filename: string; section: Section }> = body?.files || []
    const chunks = requestedFiles.flatMap(({ filename, section }) =>
      (CHUNK_LIBRARY[section] || []).map((c) => ({ ...c, source_file: filename, section })),
    )
    return json({
      status: 'success',
      total_chunks: chunks.length,
      chunks,
      source_file: requestedFiles.map((f) => f.filename).join(', ') || 'documents',
    })
  }

  if (path === 'api/intelligent/extract-fields' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const fieldSchema: Array<{ section: string; field: string }> = body?.field_schema || []
    // Demo-mode stand-in for the real LLM extraction - matches whatever
    // fields the frontend actually asked about against a small canned set of
    // plausible values, so the review-and-apply flow has something to show.
    const MOCK_FIELD_VALUES: Record<string, string> = {
      firstName: 'Demo',
      lastName: 'Student',
      schoolName: 'Demo High School',
      classYear: '2026',
      cumulativeGPA: '3.85',
      gpaScale: '4.0',
      testType: 'SAT',
      score: '1480',
    }
    const suggestions = fieldSchema
      .filter((f) => MOCK_FIELD_VALUES[f.field])
      .map((f) => ({ section: f.section, field: f.field, value: MOCK_FIELD_VALUES[f.field] }))
    return json({ suggestions })
  }

  if (path === 'api/intelligent/store' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    return json({ status: 'ok', stored_chunks: (body?.chunks || []).length })
  }

  // --- Chatbot ---
  if (path === 'api/chatbot/message' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    return json({ response: chatbotReply(String(body?.message || '')) })
  }

  // --- Org / student invitations ---
  if (path === 'api/org/invitations' && method === 'GET') {
    const orgId = searchParams.get('org_id') || ''
    return json({ items: invitations.filter((i) => i.org_id === orgId) })
  }
  if (path === 'api/org/invitations' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const orgId = body?.org_id
    const studentId = body?.student_id
    if (orgId && studentId && !invitations.some((i) => i.org_id === orgId && i.student_id === studentId)) {
      invitations.push({
        org_id: orgId,
        student_id: studentId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        org_name: 'Demo Advising Group',
      })
    }
    return json({ status: 'ok' })
  }

  if (path === 'api/org/students' && method === 'GET') {
    const orgId = searchParams.get('org_id') || ''
    const studentIds = invitations.filter((i) => i.org_id === orgId && i.status === 'accepted').map((i) => i.student_id)
    return json({ students: studentIds.map((id) => USERS[id]).filter(Boolean) })
  }

  if (path === 'api/org/students/search' && method === 'GET') {
    const query = (searchParams.get('query') || '').toLowerCase()
    const users = Object.values(USERS).filter(
      (u) => u.role === 'student' && (u.email.toLowerCase().includes(query) || `${u.first_name} ${u.last_name}`.toLowerCase().includes(query) || u.id.includes(query)),
    )
    return json({ users })
  }

  if (path === 'api/student/invitations' && method === 'GET') {
    const studentId = searchParams.get('student_id') || ''
    return json({ items: invitations.filter((i) => i.student_id === studentId) })
  }

  if ((path === 'api/student/invitations/accept' || path === 'api/student/invitations/reject') && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const inv = invitations.find((i) => i.org_id === body?.org_id && i.student_id === body?.student_id)
    if (inv) {
      inv.status = path.endsWith('accept') ? 'accepted' : 'rejected'
      inv.updated_at = new Date().toISOString()
    }
    return json({ status: 'ok' })
  }

  return json({ error: `No demo mock for ${method} /${path}` }, 404)
}
