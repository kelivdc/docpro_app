import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { DashboardHeader } from './index'
import { Route as DashboardRoute } from '../dashboard'
import { signOut } from '../../lib/auth-client'
import { deleteAccount } from '../../server/functions/delete-account'

export const Route = createFileRoute('/dashboard/profile')({
  component: ProfilePage,
  head: () => ({
    meta: [{ title: 'DocPro — Profile' }],
  }),
})

function ProfilePage() {
  const { session } = DashboardRoute.useRouteContext()
  const usage = DashboardRoute.useLoaderData()
  const user = session.user
  const navigate = useNavigate()
  const storagePct = usage?.storagePct ?? 0
  const storageSisa = 100 - storagePct
  const tokenPct = usage?.tokenPct ?? 0
  const tokenSisa = 100 - tokenPct

  const tier = (usage?.tier ?? 'free').charAt(0).toUpperCase() + (usage?.tier ?? 'free').slice(1)

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    try {
      await deleteAccount()
      await signOut({
        fetchOptions: { onSuccess: () => navigate({ to: '/login' }) },
      })
    } catch {
      setDeleting(false)
      setShowConfirm(false)
      setConfirmText('')
    }
  }

  const planLimits = [
    { label: 'File Storage', pct: storageSisa, color: 'from-blue-500 to-indigo-600' },
    { label: 'Monthly AI Tokens', pct: tokenSisa, color: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 rounded-2xl bg-[var(--bg-soft)] px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Profile</h1>
          <p className="mt-1 text-sm text-[var(--mutfg)]">Your account information and service usage.</p>
        </div>

        {/* User info card */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg font-bold text-white">
              {(user.name ?? 'U').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--fg)]">{user.name}</div>
              <div className="text-sm text-[var(--mutfg)]">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Plan info */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--fg)]">{tier} Plan</h2>
              <p className="text-xs text-[var(--mutfg)]">Tokens reset at the start of each month.</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">Active</span>
          </div>
          <div className="space-y-5">
            {planLimits.map((l) => (
              <div key={l.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-[var(--fg)]">{l.label}</span>
                  <span className="font-semibold text-[var(--fg)]">
                    {'used' in l ? (
                      <>{l.used} {l.unit}<span className="font-normal text-[var(--mutfg)]"> / {l.total} {l.unit}</span></>
                    ) : (
                      <>{l.pct}%</>
                    )}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((seg) => {
                    const threshold = (seg + 1) * 25
                    const fill = l.pct >= threshold ? 'full' : l.pct > seg * 25 && l.pct < threshold ? 'partial' : 'empty'
                    const pctInSeg = Math.max(0, Math.min(100, (l.pct - seg * 25) / 25 * 100))
                    return (
                      <div key={seg} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            fill === 'full'
                              ? `bg-gradient-to-r ${l.color}`
                              : fill === 'partial'
                                ? `bg-gradient-to-r ${l.color}`
                                : ''
                          }`}
                          style={{ width: fill === 'empty' ? '0%' : `${fill === 'full' ? 100 : pctInSeg}%` }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account info */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--fg)]">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--mutfg)]">Name</dt>
              <dd className="font-medium text-[var(--fg)]">{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--mutfg)]">Email</dt>
              <dd className="font-medium text-[var(--fg)]">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--mutfg)]">Plan</dt>
              <dd className="font-medium text-[var(--fg)]">{tier}</dd>
            </div>
          </dl>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="mb-2 text-base font-bold text-red-600">Danger Zone</h2>
          <p className="mb-4 text-sm text-[var(--mutfg)]">
            Once you delete your account, there is no going back. All your documents, chats, and data will be permanently removed.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            Remove Account
          </button>
        </div>
      </main>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-extrabold text-red-600">Remove Account</h3>
            <p className="mb-4 text-sm text-[var(--mutfg)]">
              This action is permanent. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2.5 text-sm font-bold text-[var(--fg)] transition-colors hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
