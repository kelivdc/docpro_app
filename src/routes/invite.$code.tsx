import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import Logo from '../components/Logo'
import {
  getInvitationByCodeFn,
  respondToInvitationFn,
  type InvitationByCode,
} from '../server/functions/members'
import { getSessionFromServer } from '../lib/get-session'
import type { MemberRole } from '../server/functions/members'

export const Route = createFileRoute('/invite/$code')({
  loader: async ({ params }): Promise<{ inv: InvitationByCode | null; loggedIn: boolean }> => {
    const [inv, session] = await Promise.all([
      getInvitationByCodeFn({ data: { code: params.code } }),
      getSessionFromServer(),
    ])
    return { inv, loggedIn: !!session?.user }
  },
  component: InvitePage,
  head: () => ({
    meta: [{ title: 'DocPro — Invitation' }],
  }),
})

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  active: 'Active',
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-[var(--mutfg)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--fg)]">{children}</span>
    </div>
  )
}

// Color scheme: 🟢 viewer, 🔵 member, 🟣 admin, 🟠 owner.
function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, { bg: string; text: string; dot: string }> = {
    viewer: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    member: { bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' },
    admin: { bg: 'bg-violet-500/10', text: 'text-violet-600', dot: 'bg-violet-500' },
    owner: { bg: 'bg-orange-500/10', text: 'text-orange-600', dot: 'bg-orange-500' },
  }
  const s = styles[role] ?? styles.member
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${s.bg} ${s.text} border-transparent`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function InvitePage() {
  const { inv, loggedIn } = Route.useLoaderData()
  const [busy, setBusy] = useState(false)
  const [responded, setResponded] = useState<'accepted' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  if (!inv) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md text-center">
          <Logo height={32} textClassName="text-lg font-semibold leading-none text-[var(--fg)]" />
          <h1 className="mt-8 text-2xl font-extrabold text-[var(--fg)]">Invitation not found</h1>
          <p className="mt-2 text-sm text-[var(--mutfg)]">
            This invitation link is invalid or has expired. Ask the person who invited you to send a new one.
          </p>
          <Link to="/" className="demo-button mt-6 inline-flex justify-center">
            Go to DocPro
          </Link>
        </div>
      </div>
    )
  }

  const isPending = inv.status === 'pending' && responded === null
  const showButtons = isPending && loggedIn
  const finalStatus = responded ?? (inv.status === 'pending' ? 'pending' : inv.status)

  async function handleRespond(action: 'accepted' | 'rejected') {
    setBusy(true)
    setError('')
    try {
      await respondToInvitationFn({ data: { id: inv!.id, action } })
      setResponded(action)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to respond to invitation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Logo height={32} linkTo="/" textClassName="text-lg font-semibold leading-none text-[var(--fg)]" />
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--fg)] sm:text-2xl">
            You've been invited to collaborate on DocPro
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--mutfg)]">
            You'll be able to access your team's knowledge base and use AI to search,
            summarize, and answer questions from company documents.
          </p>

          <div className="mt-6 divide-y divide-[var(--border)]/60 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
            <DetailRow label="Invited by">
              {inv.inviterName}
              {inv.inviterEmail && <span className="block text-xs font-normal text-[var(--mutfg)]">{inv.inviterEmail}</span>}
            </DetailRow>
            {inv.organizationName && <DetailRow label="Organization">{inv.organizationName}</DetailRow>}
            <div className="flex items-start justify-between gap-4 py-2">
              <span className="shrink-0 text-sm text-[var(--mutfg)]">Workspace</span>
              <span className="flex items-center gap-2 text-right text-sm font-semibold text-[var(--fg)]">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-base leading-none"
                  style={{ backgroundColor: `${inv.workspaceColor}22`, color: inv.workspaceColor }}
                >
                  {inv.workspaceIcon}
                </span>
                {inv.workspaceName}
              </span>
            </div>
            {inv.workspaceDescription && (
              <div className="py-2">
                <div className="text-sm text-[var(--mutfg)]">About this workspace</div>
                <div className="mt-1 text-sm text-[var(--fg)]">{inv.workspaceDescription}</div>
              </div>
            )}
            <DetailRow label="Role">
              <RoleBadge role={inv.role} />
            </DetailRow>
            <div className="py-2">
              <div className="text-sm text-[var(--mutfg)]">Permissions</div>
              <ul className="mt-1 space-y-1.5">
                {(ROLE_PERMISSIONS[inv.role] ?? []).map((perm) => (
                  <li key={perm} className="flex items-start gap-2 text-sm text-[var(--fg)]">
                    <span className="mt-0.5 text-emerald-600">✓</span>
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DetailRow label="Expires">
              {inv.expiresInDays !== null
                ? `In ${inv.expiresInDays} day${inv.expiresInDays === 1 ? '' : 's'}`
                : '—'}
            </DetailRow>
            <DetailRow label="Status">
              <span
                className={
                  finalStatus === 'accepted'
                    ? 'text-emerald-600'
                    : finalStatus === 'rejected'
                      ? 'text-red-600'
                      : 'text-amber-600'
                }
              >
                {STATUS_LABELS[finalStatus] ?? finalStatus}
              </span>
            </DetailRow>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6">
            {showButtons && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleRespond('accepted')}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? 'Processing…' : 'Join Workspace'}
                </button>
                <button
                  onClick={() => handleRespond('rejected')}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-bold text-red-600 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {!showButtons && responded === null && inv.status === 'pending' && !loggedIn && (
              <div className="space-y-3">
                <p className="text-center text-sm text-[var(--mutfg)]">
                  Sign in with <span className="font-semibold text-[var(--fg)]">{inv.email}</span> to accept this invitation.
                </p>
                <div className="flex gap-3">
                  <Link to="/login" search={{ blocked: undefined }} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700">
                    Sign in
                  </Link>
                  <Link to="/register" className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-center text-sm font-bold text-[var(--fg)] hover:bg-[var(--muted)]">
                    Create account
                  </Link>
                </div>
              </div>
            )}

            {(responded === 'accepted' || inv.status === 'accepted') && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-[var(--fg)]">
                You've joined <span className="font-semibold">{inv.workspaceName}</span>. Welcome aboard!
                <div className="mt-3">
                  <Link to="/dashboard" className="demo-button inline-flex justify-center">
                    Go to your dashboard
                  </Link>
                </div>
              </div>
            )}

            {responded === 'rejected' && (
              <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--mutfg)]">
                You declined the invitation to <span className="font-semibold text-[var(--fg)]">{inv.workspaceName}</span>.
              </div>
            )}

            {!loggedIn && responded === null && inv.status !== 'pending' && (
              <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--mutfg)]">
                This invitation has been {STATUS_LABELS[inv.status]?.toLowerCase() ?? inv.status}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
