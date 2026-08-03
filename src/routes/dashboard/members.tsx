import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createPortal } from 'react-dom'
import { DashboardHeader } from './index'
import {
  getMembersFn,
  inviteMemberFn,
  updateMemberRoleFn,
  updateMemberStatusFn,
  removeMemberFn,
  getMyInvitationsFn,
  respondToInvitationFn,
  type MemberView,
  type MemberRole,
  type MemberStatus,
  type InvitationView,
} from '../../server/functions/members'

export const Route = createFileRoute('/dashboard/members')({
  loader: async () => {
    try {
      const [res, invRes] = await Promise.all([
        getMembersFn(),
        getMyInvitationsFn(),
      ])
      return { members: res.members, myInvitations: invRes.invitations }
    } catch (error) {
      console.error('Error loading members:', error)
      return { members: [], myInvitations: [] }
    }
  },
  component: MembersPage,
  head: () => ({
    meta: [{ title: 'DocPro — Members' }],
  }),
})

function StatCard({
  icon,
  accent,
  value,
  label,
}: {
  icon: React.ReactNode
  accent: string
  value: string | number
  label: string
}) {
  return (
    <div className="card-premium flex items-center gap-4 p-5">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accent}`}>{icon}</div>
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">{value}</div>
        <div className="text-xs font-semibold text-[var(--mutfg)]">{label}</div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: MemberRole }) {
  const styles: Record<MemberRole, { bg: string; text: string; border: string; label: string }> = {
    owner: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20', label: 'Owner' },
    admin: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', label: 'Admin' },
    member: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', label: 'Member' },
    viewer: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/20', label: 'Viewer' },
  }
  const s = styles[role] ?? styles.member
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${s.bg} ${s.border} px-3 py-1 text-xs font-bold ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.text.replace('text-', 'bg-')}`} />
      {s.label}
    </span>
  )
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const map: Record<MemberStatus, { dot: string; text: string; label: string; pulse?: boolean }> = {
    pending:  { dot: 'bg-amber-400',   text: 'text-amber-600',   label: 'Pending',  pulse: true },
    accepted: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Accepted' },
    rejected: { dot: 'bg-red-500',     text: 'text-red-600',     label: 'Rejected' },
    active:   { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Active' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}${s.pulse ? ' animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}

function MembersPage() {
  const initialData = Route.useLoaderData()
  const [members, setMembers] = useState<MemberView[]>(initialData.members ?? [])
  const [myInvitations, setMyInvitations] = useState<InvitationView[]>(initialData.myInvitations ?? [])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Invite Modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Remove Modal state
  const [memberToRemove, setMemberToRemove] = useState<MemberView | null>(null)
  const [removing, setRemoving] = useState(false)

  // Role Update State
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const handleStatusChange = async (memberId: string, newStatus: MemberStatus) => {
    setUpdatingStatusId(memberId)
    try {
      await updateMemberStatusFn({ data: { id: memberId, status: newStatus } })
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: newStatus } : m)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleRespondInvitation = async (id: string, action: 'accepted' | 'rejected') => {
    setUpdatingStatusId(id)
    try {
      await respondToInvitationFn({ data: { id, action } })
      setMyInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: action } : inv)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to respond to invitation')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const filteredMembers = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  const adminCount = members.filter((m) => m.role === 'admin' || m.role === 'owner').length
  const activeCount = members.filter((m) => m.status === 'active').length

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)
    try {
      const res = await inviteMemberFn({
        data: { email: inviteEmail, role: inviteRole },
      })
      if (res.ok && res.member) {
        setMembers((prev) => [...prev, res.member])
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole('member')
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: MemberRole) => {
    setUpdatingId(memberId)
    try {
      await updateMemberRoleFn({ data: { id: memberId, role: newRole } })
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return
    setRemoving(true)
    try {
      await removeMemberFn({ data: { id: memberToRemove.id } })
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id))
      setMemberToRemove(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <DashboardHeader />
      <main className="flex-1 bg-[var(--bg-soft)]">
        <div className="mx-auto w-full max-w-[1200px] space-y-8 px-6 py-8">
          {/* Header section */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--fg)]">Team Members</h1>
              <p className="mt-1.5 text-sm text-[var(--mutfg)]">
                Manage organization members, assign access roles, and collaborate efficiently.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Invite Member
            </button>
          </div>

          {/* My Invitations section — visible only when there are invitations for the current user */}
          {myInvitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-extrabold text-amber-700">
                  Your Organization Invitations
                </h2>
              </div>
              <div className="space-y-3">
                {myInvitations.map((inv) => {
                  const orgLabel = inv.orgName || inv.ownerEmail
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4"
                    >
                      <div>
                        <div className="text-sm font-bold text-[var(--fg)]">
                          Invited to join <span className="text-blue-600">{orgLabel}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--mutfg)]">
                          <RoleBadge role={inv.role} />
                          <span>·</span>
                          <StatusBadge status={inv.status} />
                        </div>
                      </div>
                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={updatingStatusId === inv.id}
                            onClick={() => handleRespondInvitation(inv.id, 'accepted')}
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                          >
                            ✓ Accept
                          </button>
                          <button
                            disabled={updatingStatusId === inv.id}
                            onClick={() => handleRespondInvitation(inv.id, 'rejected')}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                      {inv.status !== 'pending' && (
                        <StatusBadge status={inv.status} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}


          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              accent="bg-blue-500/10 text-blue-600"
              value={members.length}
              label="Total Team Members"
            />
            <StatCard
              icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              accent="bg-indigo-500/10 text-indigo-600"
              value={adminCount}
              label="Admins & Owners"
            />
            <StatCard
              icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              accent="bg-emerald-500/10 text-emerald-600"
              value={activeCount}
              label="Active Members"
            />
          </div>

          {/* Search & Filter */}
          <div className="card-premium space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mutfg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--mutfg)]">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--fg)] outline-none focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-xs font-bold text-[var(--mutfg)] uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Member</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Joined</th>
                    <th className="px-6 py-3.5">Expires</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50 bg-[var(--card-bg)]">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--mutfg)]">
                        No team members found.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const isOwner = m.isOwner || m.role === 'owner'
                      const initial = (m.name || 'U').charAt(0).toUpperCase()
                      const formattedDate = new Date(m.createdAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })
                      const isExpired = m.expiresAt && new Date(m.expiresAt) < new Date()
                      const formattedExpires = m.expiresAt
                        ? new Date(m.expiresAt).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })
                        : null

                      return (
                        <tr key={m.id} className="hover:bg-[var(--muted)]/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-sm">
                                {initial}
                              </div>
                              <div>
                                <div className="font-bold text-[var(--fg)] flex items-center gap-2">
                                  {m.name}
                                  {m.isOwner && (
                                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 border border-blue-500/20">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--mutfg)]">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <RoleBadge role={m.role} />
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={m.status} />
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-[var(--mutfg)]">
                            {formattedDate}
                          </td>
                          <td className="px-6 py-4 text-xs font-medium">
                            {formattedExpires ? (
                              <span className={isExpired ? 'text-red-600 font-bold' : 'text-amber-600'}>
                                {formattedExpires}
                                {isExpired && ' (expired)'}
                              </span>
                            ) : (
                              <span className="text-[var(--mutfg)]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isOwner ? (
                              <span className="text-xs font-semibold text-[var(--mutfg)] italic">No actions</span>
                            ) : (
                              <div className="flex items-center justify-end gap-3">
                                <select
                                  disabled={updatingId === m.id}
                                  value={m.role}
                                  onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                                  className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)] outline-none focus:border-blue-500"
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>

                                <button
                                  onClick={() => setMemberToRemove(m)}
                                  className="rounded-lg p-1.5 text-[var(--mutfg)] transition-colors hover:bg-red-500/10 hover:text-red-600"
                                  title="Remove member"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Invite Member Modal */}
      {showInviteModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <h3 className="text-lg font-extrabold text-[var(--fg)]">Invite Team Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg p-1 text-[var(--mutfg)] hover:bg-[var(--muted)]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="mt-4 space-y-4">
                {inviteError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-medium text-red-600">
                    {inviteError}
                  </div>
                )}



                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fg)]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@company.com"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fg)]">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-blue-500"
                  >
                    <option value="viewer">Viewer — Read-only access & AI chat</option>
                    <option value="member">Member — Can upload knowledge & use AI chat</option>
                    <option value="admin">Admin — Full access to management & knowledge</option>
                  </select>
                </div>

                <div className="mt-6 flex items-center gap-3 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-bold text-[var(--fg)] hover:bg-[var(--muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviting ? 'Inviting…' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Remove Confirmation Modal */}
      {memberToRemove &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-2xl">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-[var(--fg)]">Remove Member</h3>
              <p className="mt-1 text-sm text-[var(--mutfg)]">
                Are you sure you want to remove <strong className="text-[var(--fg)]">{memberToRemove.name}</strong> ({memberToRemove.email}) from your organization?
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setMemberToRemove(null)}
                  className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-bold text-[var(--fg)] hover:bg-[var(--muted)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveConfirm}
                  disabled={removing}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
