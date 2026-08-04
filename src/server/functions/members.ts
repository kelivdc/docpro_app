import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq, and, sql } from 'drizzle-orm'
import { auth } from '../../lib/auth'
import { db } from '../../lib/db'
import { organizationMembers, type MemberRole, type MemberStatus } from '../../lib/schema/members'
import { workspaces } from '../../lib/schema/documents'

export type { MemberRole, MemberStatus }
import { tenantMap } from '../../lib/schema/tenant'
import { user } from '../../lib/schema/auth'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

// Resolve the app's public base URL from the incoming request so the same
// code works in dev (http://localhost:3000) and behind the VPS proxy
// (https://docpro.nexonace.com). Falls back to the production domain.
function getAppBaseUrl(): string {
  const req = getRequest()
  const host = req?.headers.get('host')
  if (host) {
    const proto = req?.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return 'https://docpro.nexonace.com'
}

async function ensureMembersTableExists() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS organization_members (
        id text PRIMARY KEY,
        owner_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
        user_id text REFERENCES "user"(id) ON DELETE set null,
        name text,
        email text NOT NULL,
        invite_code text,
        role text NOT NULL DEFAULT 'member',
        status text NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `)
    await db.execute(sql`ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS invite_code text`)
    await db.execute(
      sql.raw(`
        UPDATE organization_members
        SET invite_code = upper(substr(md5(id || ':' || created_at), 1, 10))
        WHERE invite_code IS NULL
      `),
    )
  } catch (error) {
    console.error('Error ensuring organization_members table:', error)
  }
}

// Short, unambiguous invite code (no 0/O, 1/I) used for /invite/<code> links.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateInviteCode(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10))
  let code = ''
  for (let i = 0; i < 10; i++) code += INVITE_ALPHABET[rnd[i] % INVITE_ALPHABET.length]
  return code
}

export interface MemberView {
  id: string
  ownerId: string
  userId: string | null
  name: string
  email: string
  inviteCode: string | null
  role: MemberRole
  status: MemberStatus
  createdAt: string
  expiresAt: string | null
  isOwner?: boolean
}

export const getMembersFn = createServerFn({ method: 'GET' }).handler(async (): Promise<{ members: MemberView[] }> => {
  const userId = await currentUserId()
  const session = await auth.api.getSession({ headers: getRequest()?.headers })
  const user = session?.user

  // Ensure table exists defensively
  await ensureMembersTableExists()

  // Fetch invited/added members
  let rows: any[] = []
  try {
    rows = await db.select().from(organizationMembers).where(eq(organizationMembers.ownerId, userId))
  } catch (error) {
    console.error('Error fetching organization members:', error)
  }

  const list: MemberView[] = rows.map((r) => {
    const displayName = r.name || r.email.split('@')[0]
    return {
      id: r.id,
      ownerId: r.ownerId,
      userId: r.userId,
      name: displayName,
      email: r.email,
      inviteCode: r.inviteCode ?? null,
      role: r.role as MemberRole,
      status: r.status as MemberStatus,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    }
  })

  // Ensure current Owner is always first in list
  const ownerMember: MemberView = {
    id: `owner-${userId}`,
    ownerId: userId,
    userId: userId,
    name: (user?.name ?? 'Account Owner') + ' (You)',
    email: user?.email ?? '',
    inviteCode: null,
    role: 'owner',
    status: 'active',
    createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    expiresAt: null,
    isOwner: true,
  }

  return { members: [ownerMember, ...list] }
})

export const inviteMemberFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { email?: string; role?: MemberRole }
    const email = d?.email?.trim().toLowerCase()
    const role = (d?.role ?? 'member') as MemberRole

    if (!email || !email.includes('@')) throw new Error('Valid email is required')
    return { email, role }
  })
  .handler(async ({ data }): Promise<{ ok: true; member: MemberView }> => {
    const session = await auth.api.getSession({ headers: getRequest()?.headers })
    const userId = session?.user?.id
    if (!userId) throw new Error('UNAUTHENTICATED')
    const inviterName = session?.user?.name || data.email
    const inviterEmail = session?.user?.email ?? ''

    await ensureMembersTableExists()

    // Check if member already exists
    const existing = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.ownerId, userId), eq(organizationMembers.email, data.email)))

    if (existing.length > 0) {
      throw new Error('A member with this email already exists in your organization')
    }

    const id = crypto.randomUUID()
    const now = new Date()
    const nameFromEmail = data.email.split('@')[0]
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const inviteCode = generateInviteCode()

    await db.insert(organizationMembers).values({
      id,
      ownerId: userId,
      name: nameFromEmail,
      email: data.email,
      inviteCode,
      role: data.role,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })

    // Send invitation email (non-blocking on failure so the invite still succeeds).
    void sendInvitationEmail({
      to: data.email,
      inviteCode,
      inviterName,
      inviterEmail,
      ownerId: userId,
      role: data.role,
      expiresAt,
      baseUrl: getAppBaseUrl(),
    })

    return {
      ok: true,
      member: {
        id,
        ownerId: userId,
        userId: null,
        name: nameFromEmail,
        email: data.email,
        inviteCode,
        role: data.role,
        status: 'pending',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    }
  })

async function sendInvitationEmail(opts: {
  to: string
  inviteCode: string
  inviterName: string
  inviterEmail: string
  ownerId: string
  role: MemberRole
  expiresAt: Date
  baseUrl: string
}) {
  const { to, inviteCode, inviterName, inviterEmail, ownerId, role, expiresAt, baseUrl } = opts
  try {
    // Workspace info: default workspace (name, logo, description), org name for the company.
    let workspaceName = 'My Workspace'
    let workspaceDescription: string | null = null
    let workspaceIcon = '🏛'
    let workspaceColor = '#2563EB'
    let organizationName: string | null = null
    let logoCid: string | null = null
    let attachments: Array<{ filename?: string; content: Buffer; cid: string }> = []
    try {
      const ws = await db.query.workspaces.findFirst({
        where: and(eq(workspaces.ownerId, ownerId), eq(workspaces.isDefault, true)),
        columns: { name: true, description: true, icon: true, color: true },
      })
      if (ws?.name) workspaceName = ws.name
      if (ws?.description) workspaceDescription = ws.description
      if (ws?.icon) workspaceIcon = ws.icon
      if (ws?.color) workspaceColor = ws.color
    } catch { /* keep defaults */ }
    try {
      const tm = await db.query.tenantMap.findFirst({
        where: eq(tenantMap.userId, ownerId),
        columns: { orgName: true, orgLogo: true, bucket: true },
      })
      if (tm?.orgName) organizationName = tm.orgName

      // Organization logo (uploaded on the profile page) as an inline email
      // attachment so it always renders regardless of presigned-URL expiry.
      if (tm?.orgLogo) {
        const { getObject } = await import('../minio')
        const buf = await getObject(tm.bucket, tm.orgLogo)
        if (buf.length > 0) {
          logoCid = 'docpro-org-logo'
          attachments = [{ filename: 'org-logo', content: buf, cid: logoCid }]
        }
      }
    } catch (e) {
      console.error('[members] failed to load org logo for invitation email:', e)
    }

    const acceptUrl = `${baseUrl}/invite/${inviteCode}`
    const days = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    const expiresLabel = expiresAt.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.member
    const { sendEmail } = await import('../email')
    const { subject, text, html } = renderInvitationEmail({
      to,
      acceptUrl,
      inviterName,
      inviterEmail,
      organizationName,
      workspaceName,
      workspaceIcon,
      workspaceColor,
      workspaceDescription,
      logoCid,
      role,
      permissions,
      days,
      expiresLabel,
    })

    await sendEmail({ to, subject, text, html, attachments })
  } catch (e) {
    console.error(`[members] failed to send invitation email to ${to} (${inviteCode}):`, e)
  }
}

const ROLE_PERMISSIONS: Record<MemberRole, string[]> = {
  owner: [
    'Full access — manage everything, including members, billing, and knowledge',
    'Upload and manage documents',
    'Run AI searches and chat with the knowledge base',
  ],
  admin: [
    'Add or remove members and manage their roles',
    'Upload and manage documents',
    'Run AI searches and chat with the knowledge base',
  ],
  member: [
    'Upload documents',
    'Run AI searches and chat with the knowledge base',
  ],
  viewer: [
    'Read documents',
    'Use AI chat',
  ],
}

export interface InvitationEmailContent {
  to: string
  acceptUrl: string
  inviterName: string
  inviterEmail: string
  organizationName: string | null
  workspaceName: string
  workspaceIcon: string
  workspaceColor: string
  workspaceDescription: string | null
  logoCid: string | null
  role: MemberRole
  permissions: string[]
  days: number
  expiresLabel: string
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

function roleLabel(role: MemberRole): string {
  return ROLE_LABELS[role] ?? role
}

// Color scheme: 🟢 viewer, 🔵 member, 🟣 admin, 🟠 owner.
const ROLE_BADGE: Record<MemberRole, { bg: string; color: string; dot: string }> = {
  viewer: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  member: { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  admin: { bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  owner: { bg: '#ffedd5', color: '#c2410c', dot: '#f97316' },
}

function roleBadgeHtml(role: MemberRole): string {
  const b = ROLE_BADGE[role] ?? ROLE_BADGE.member
  return `<span style="display:inline-flex;align-items:center;gap:6px;background:${b.bg};color:${b.color};font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px;line-height:1.4;"><span style="width:7px;height:7px;border-radius:50%;background:${b.dot};"></span>${roleLabel(role)}</span>`
}

// Pure builder so the template can be inspected/tested without sending.
export function renderInvitationEmail(p: InvitationEmailContent): { subject: string; text: string; html: string } {
  const {
    to,
    acceptUrl,
    inviterName,
    inviterEmail,
    organizationName,
    workspaceName,
    workspaceIcon,
    workspaceColor,
    workspaceDescription,
    logoCid,
    role,
    permissions,
    days,
    expiresLabel,
  } = p

  const headerLogo = logoCid
    ? `<img src="cid:${logoCid}" alt="Organization logo" style="width:44px;height:44px;border-radius:12px;background:#ffffff;padding:6px;object-fit:contain;display:inline-block;vertical-align:middle;" />`
    : ''

  const orgRow = organizationName
    ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:13px;color:#6b7280;">Organization</span>
              <span style="font-size:14px;font-weight:700;color:#111827;">${organizationName}</span>
            </div>`
    : ''

  const aboutRow = workspaceDescription
    ? `
            <div style="margin-bottom:12px;">
              <div style="font-size:13px;color:#6b7280;margin-bottom:2px;">About this workspace</div>
              <div style="font-size:14px;color:#374151;">${workspaceDescription}</div>
            </div>`
    : ''

  const permissionList = permissions
    .map(
      (perm) => `
            <li style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:14px;line-height:1.45;color:#374151;">
              <span style="color:#2563eb;line-height:1.45;">✓</span>
              <span>${perm}</span>
            </li>`,
    )
    .join('')

  const html = `
    <div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef2;">
        <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 32px;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${headerLogo}
            <div>
              <div style="color:#ffffff;font-size:22px;font-weight:800;line-height:1.2;">${organizationName || 'DocPro'}</div>
              <div style="color:#c7d2fe;font-size:13px;margin-top:2px;">Your team knowledge base, answered by AI</div>
            </div>
          </div>
        </div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;color:#111827;">You've been invited to collaborate on DocPro</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
            You'll be able to access your team's knowledge base and use AI to search,
            summarize, and answer questions from company documents.
          </p>

          <div style="background:#f8fafc;border:1px solid #eef1f6;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
              <span style="font-size:13px;color:#6b7280;">Invited by</span>
              <span style="font-size:14px;font-weight:700;color:#111827;">${inviterName}${inviterEmail ? ` <a href="mailto:${inviterEmail}" style="color:#2563eb;text-decoration:none;font-weight:600;">&lt;${inviterEmail}&gt;</a>` : ''}</span>
            </div>
            ${orgRow}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:13px;color:#6b7280;">Workspace</span>
              <span style="display:inline-flex;align-items:center;gap:8px;max-width:70%;">
                <span style="width:28px;height:28px;flex:0 0 28px;border-radius:8px;background:${workspaceColor}22;display:inline-flex;align-items:center;justify-content:center;font-size:16px;line-height:1;">${workspaceIcon}</span>
                <span style="font-size:14px;font-weight:700;color:#111827;">${workspaceName}</span>
              </span>
            </div>
            ${aboutRow}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:13px;color:#6b7280;">Your role</span>
              ${roleBadgeHtml(role)}
            </div>
            <div>
              <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">Permissions</div>
              <ul style="margin:0;padding:0;list-style:none;">${permissionList}
              </ul>
            </div>
          </div>

          <div style="font-size:13px;color:#6b7280;margin-bottom:24px;text-align:center;">
            This invitation expires in <strong style="color:#111827;">${days} day${days === 1 ? '' : 's'}</strong>
            <span style="color:#9ca3af;"> (${expiresLabel})</span>
          </div>

          <a href="${acceptUrl}" style="display:block;text-align:center;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;">
            Join Workspace
          </a>

          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
            If the button doesn't work, copy this link into your browser:<br/>
            <a href="${acceptUrl}" style="color:#2563eb;word-break:break-all;">${acceptUrl}</a>
          </p>
        </div>

        <div style="border-top:1px solid #eef1f6;padding:24px 32px;background:#fafbfc;">
          <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:4px;">Need help?</div>
          <a href="mailto:support@docpro.ai" style="font-size:13px;color:#2563eb;text-decoration:none;">support@docpro.ai</a>
          <div style="font-size:12px;color:#9ca3af;margin-top:12px;">This invitation was sent to ${to}</div>
        </div>
      </div>
    </div>
  `

  const text = [
    `You've been invited to collaborate on DocPro. You'll be able to access your team's`,
    `knowledge base and use AI to search, summarize, and answer questions from company documents.`,
    '',
    `Invited by: ${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''}`,
    ...(organizationName ? [`Organization: ${organizationName}`] : []),
    `Workspace: ${workspaceIcon} ${workspaceName}`,
    ...(workspaceDescription ? [`About: ${workspaceDescription}`] : []),
    `Role: ${roleLabel(role)}`,
    'Permissions:',
    ...permissions.map((perm) => `  - ${perm}`),
    '',
    `This invitation expires in ${days} day${days === 1 ? '' : 's'} (${expiresLabel}).`,
    '',
    `Join the workspace: ${acceptUrl}`,
    '',
    'Need help? support@docpro.ai',
    `This invitation was sent to ${to}`,
  ].join('\n')
  return { subject: 'You\'ve been invited to collaborate on DocPro', text, html }
}

export const updateMemberRoleFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id?: string; role?: MemberRole }
    if (!d?.id) throw new Error('Member ID is required')
    if (!d?.role) throw new Error('Role is required')
    return { id: d.id, role: d.role }
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const userId = await currentUserId()

    await db
      .update(organizationMembers)
      .set({ role: data.role, updatedAt: new Date() })
      .where(and(eq(organizationMembers.id, data.id), eq(organizationMembers.ownerId, userId)))

    return { ok: true }
  })

export const removeMemberFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id?: string }
    if (!d?.id) throw new Error('Member ID is required')
    return { id: d.id }
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const userId = await currentUserId()

    await db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.id, data.id), eq(organizationMembers.ownerId, userId)))

    return { ok: true }
  })

export const updateMemberStatusFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id?: string; status?: MemberStatus }
    if (!d?.id) throw new Error('Member ID is required')
    if (!d?.status) throw new Error('Status is required')
    const allowed: MemberStatus[] = ['pending', 'accepted', 'rejected', 'active']
    if (!allowed.includes(d.status)) throw new Error('Invalid status')
    return { id: d.id, status: d.status }
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const userId = await currentUserId()

    await db
      .update(organizationMembers)
      .set({ status: data.status, updatedAt: new Date() })
      .where(and(eq(organizationMembers.id, data.id), eq(organizationMembers.ownerId, userId)))

    return { ok: true }
  })

export interface InvitationView {
  id: string
  ownerId: string
  ownerEmail: string
  orgName: string | null
  role: MemberRole
  status: MemberStatus
  createdAt: string
}

/** Fetch pending/all invitations for the currently logged-in user (matched by email). */
export const getMyInvitationsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<{ invitations: InvitationView[] }> => {
  const session = await auth.api.getSession({ headers: getRequest()?.headers })
  const userEmail = session?.user?.email
  const userId = session?.user?.id
  if (!userEmail || !userId) return { invitations: [] }

  await ensureMembersTableExists()

  let rows: any[] = []
  try {
    // Find all invitation rows where this user's email appears but they are NOT the owner
    rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.email, userEmail))
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return { invitations: [] }
  }

  // Enrich with owner info (org name)
  const invitations: InvitationView[] = []
  for (const r of rows) {
    // Skip if the user IS the owner of this record
    if (r.ownerId === userId) continue
    let orgName: string | null = null
    let ownerEmail = ''
    try {
      const tm = await db.query.tenantMap.findFirst({
        where: eq(tenantMap.userId, r.ownerId),
        columns: { orgName: true, email: true },
      })
      orgName = tm?.orgName ?? null
      ownerEmail = tm?.email ?? r.ownerId
    } catch {
      ownerEmail = r.ownerId
    }
    // Auto-link userId if not yet linked
    if (!r.userId) {
      try {
        await db
          .update(organizationMembers)
          .set({ userId, updatedAt: new Date() })
          .where(eq(organizationMembers.id, r.id))
      } catch { /* ignore */ }
    }
    invitations.push({
      id: r.id,
      ownerId: r.ownerId,
      ownerEmail,
      orgName,
      role: r.role as MemberRole,
      status: r.status as MemberStatus,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    })
  }

  return { invitations }
})

export interface InvitationByCode {
  id: string
  email: string
  inviterName: string
  inviterEmail: string
  organizationName: string | null
  workspaceName: string
  workspaceIcon: string
  workspaceColor: string
  workspaceDescription: string | null
  role: MemberRole
  status: MemberStatus
  expiresAt: string | null
  expiresInDays: number | null
}

/** Public lookup for the /invite/<code> page (no auth required — the code is the token). */
export const getInvitationByCodeFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { code?: string }
    if (!d?.code?.trim()) throw new Error('Invitation code is required')
    return { code: d.code.trim().toUpperCase() }
  })
  .handler(async ({ data }): Promise<InvitationByCode | null> => {
    await ensureMembersTableExists()
    const [row] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.inviteCode, data.code))
    if (!row) return null

    let inviterName = 'Your team'
    let inviterEmail = ''
    try {
      const inviter = await db.query.user.findFirst({
        where: eq(user.id, row.ownerId),
        columns: { name: true, email: true },
      })
      if (inviter?.name) inviterName = inviter.name
      inviterEmail = inviter?.email ?? ''
    } catch { /* keep default */ }

    let workspaceName = 'My Workspace'
    let workspaceDescription: string | null = null
    let workspaceIcon = '🏛'
    let workspaceColor = '#2563EB'
    let organizationName: string | null = null
    try {
      const ws = await db.query.workspaces.findFirst({
        where: and(eq(workspaces.ownerId, row.ownerId), eq(workspaces.isDefault, true)),
        columns: { name: true, description: true, icon: true, color: true },
      })
      if (ws?.name) workspaceName = ws.name
      if (ws?.description) workspaceDescription = ws.description
      if (ws?.icon) workspaceIcon = ws.icon
      if (ws?.color) workspaceColor = ws.color
    } catch { /* keep defaults */ }
    try {
      const tm = await db.query.tenantMap.findFirst({
        where: eq(tenantMap.userId, row.ownerId),
        columns: { orgName: true },
      })
      if (tm?.orgName) organizationName = tm.orgName
    } catch { /* keep default */ }

    const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null
    const expiresInDays = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null

    return {
      id: row.id,
      email: row.email,
      inviterName,
      inviterEmail,
      organizationName,
      workspaceName,
      workspaceIcon,
      workspaceColor,
      workspaceDescription,
      role: row.role as MemberRole,
      status: row.status as MemberStatus,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      expiresInDays,
    }
  })

/** Called by the invitee (not the owner) to accept or reject their invitation. */
export const respondToInvitationFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id?: string; action?: 'accepted' | 'rejected' }
    if (!d?.id) throw new Error('Invitation ID is required')
    if (d?.action !== 'accepted' && d?.action !== 'rejected') throw new Error('Action must be accepted or rejected')
    return { id: d.id, action: d.action }
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const session = await auth.api.getSession({ headers: getRequest()?.headers })
    const userEmail = session?.user?.email
    if (!userEmail) throw new Error('UNAUTHENTICATED')

    // Verify this invitation belongs to the current user's email
    const existing = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, data.id))

    if (existing.length === 0) throw new Error('Invitation not found')
    if (existing[0].email !== userEmail) throw new Error('This invitation does not belong to you')

    await db
      .update(organizationMembers)
      .set({
        status: data.action,
        ...(data.action === 'accepted' && session?.user?.id ? { userId: session.user.id } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizationMembers.id, data.id))

    return { ok: true }
  })
