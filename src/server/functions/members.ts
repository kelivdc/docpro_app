import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq, and, sql } from 'drizzle-orm'
import { auth } from '../../lib/auth'
import { db } from '../../lib/db'
import { organizationMembers, type MemberRole, type MemberStatus } from '../../lib/schema/members'
import { sendEmail, getAppBaseUrl, roleLabel } from '../email'

export type { MemberRole, MemberStatus }
import { tenantMap } from '../../lib/schema/tenant'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
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
        role text NOT NULL DEFAULT 'member',
        status text NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `)
  } catch (error) {
    console.error('Error ensuring organization_members table:', error)
  }
}

export interface MemberView {
  id: string
  ownerId: string
  userId: string | null
  name: string
  email: string
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

    await db.insert(organizationMembers).values({
      id,
      ownerId: userId,
      name: nameFromEmail,
      email: data.email,
      role: data.role,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })

    // Send invitation email (non-blocking on failure so the invite still succeeds).
    void sendInvitationEmail({
      to: data.email,
      memberId: id,
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
        role: data.role,
        status: 'pending',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    }
  })

async function sendInvitationEmail(opts: {
  to: string
  memberId: string
  inviterName: string
  inviterEmail: string
  ownerId: string
  role: MemberRole
  expiresAt: Date
  baseUrl: string
}) {
  const { to, memberId, inviterName, inviterEmail, ownerId, role, expiresAt, baseUrl } = opts
  try {
    let orgName = 'their organization'
    try {
      const tm = await db.query.tenantMap.findFirst({
        where: eq(tenantMap.userId, ownerId),
        columns: { orgName: true },
      })
      if (tm?.orgName) orgName = tm.orgName
    } catch { /* keep default */ }

    const acceptUrl = `${baseUrl}/dashboard/members`
    const expiresLabel = expiresAt.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })

    const html = `
      <div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef2;">
          <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 32px;">
            <div style="color:#ffffff;font-size:22px;font-weight:800;">DocPro</div>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">You've been invited to join a team</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
              <strong style="color:#111827;">${inviterName}</strong> (${
                inviterEmail ? `<a href="mailto:${inviterEmail}" style="color:#2563eb;">${inviterEmail}</a>` : ''
              })
              has invited you to join <strong style="color:#111827;">${orgName}</strong> on DocPro.
            </p>

            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr>
                <td style="padding:10px 12px;font-size:13px;color:#6b7280;width:120px;">Organization</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#111827;">${orgName}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;font-size:13px;color:#6b7280;">Your role</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#111827;">${roleLabel(role)}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;font-size:13px;color:#6b7280;">Invitation expires</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#111827;">${expiresLabel}</td>
              </tr>
            </table>

            <a href="${acceptUrl}" style="display:block;text-align:center;background:#2563eb;color:#ffffff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;">
              View Invitation
            </a>

            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
              If you don't have a DocPro account yet, create one with the same email address
              (${to}), then open the invitation from the
              <strong>Team Members</strong> page and click <strong>Accept</strong>.
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
              If the button doesn't work, copy this link into your browser:<br/>
              <a href="${acceptUrl}" style="color:#2563eb;word-break:break-all;">${acceptUrl}</a>
            </p>
          </div>
        </div>
      </div>
    `
    const text = [
      `You've been invited to join ${orgName} on DocPro.`,
      `Invited by ${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''}.`,
      `Role: ${roleLabel(role)}`,
      `This invitation expires on ${expiresLabel}.`,
      '',
      `To accept, open ${acceptUrl}, sign in or create an account with ${to},`,
      `and click Accept on the Team Members page.`,
    ].join('\n')

    await sendEmail({ to, subject: `You've been invited to join ${orgName} on DocPro`, text, html })
  } catch (e) {
    console.error(`[members] failed to send invitation email to ${to} (${memberId}):`, e)
  }
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
      .set({ status: data.action, updatedAt: new Date() })
      .where(eq(organizationMembers.id, data.id))

    return { ok: true }
  })
