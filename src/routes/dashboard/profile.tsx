import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { DashboardHeader } from './index'
import { Route as DashboardRoute } from '../dashboard'
import { signOut } from '../../lib/auth-client'
import { deleteAccount, cancelDeleteAccount } from '../../server/functions/delete-account'
import { DonutChart } from '../../components/DonutChart'
import { getSubscriptionStatus } from '../../server/functions/subscription'
import { getProfileFn, updateOrgNameFn, updateOrgLogoFn } from '../../server/functions/profile'

export const Route = createFileRoute('/dashboard/profile')({
  loader: async () => {
    try {
      const [sub, profile] = await Promise.all([
        getSubscriptionStatus(),
        getProfileFn()
      ])
      return { sub, profile }
    } catch (error) {
      console.error('Error loading profile data:', error)
      // Return default values if there's an error
      return {
        sub: {
          active: false,
          tier: null,
          expiresAt: null,
          topupBalance: 0,
          topupUsed: 0
        },
        profile: {
          name: null,
          email: '',
          orgName: null,
          orgLogoUrl: null,
          tier: 'free'
        }
      }
    }
  },
  component: ProfilePage,
  head: () => ({
    meta: [{ title: 'DocPro — Profile' }],
  }),
})

function ProfilePage() {
  const { session } = DashboardRoute.useRouteContext()
  const usage = DashboardRoute.useLoaderData()
  const { sub, profile } = Route.useLoaderData()
  const user = session.user
  const navigate = useNavigate()
  const storagePct = usage?.storagePct ?? 0
  const tokenPct = usage?.tokenPct ?? 0

  const tier = (usage?.tier ?? 'free').charAt(0).toUpperCase() + (usage?.tier ?? 'free').slice(1)
  const deleted = usage?.deletionScheduled ?? false

  const formatToken = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`

  const charts = [
    { label: 'File Storage', pct: 100 - storagePct, value: `${(usage?.storageTotalMb ?? 0) - (usage?.storageUsedMb ?? 0)} MB`, subvalue: `${usage?.storageTotalMb ?? 0} MB`, color: '#3b82f6 #4f46e5' },
    { label: 'Monthly AI Tokens', pct: 100 - tokenPct, value: formatToken((usage?.tokenTotal ?? 0) - (usage?.tokenUsed ?? 0)), subvalue: formatToken(usage?.tokenTotal ?? 0), color: '#10b981 #14b8a6' },
  ]
  if (usage && usage.topupTotal > 0) {
    const topupPct = Math.min(100, Math.round((usage.topupUsed / usage.topupTotal) * 100))
    charts.push({ label: 'Top-Up Tokens', pct: 100 - topupPct, value: formatToken(usage.topupTotal - usage.topupUsed), subvalue: formatToken(usage.topupTotal), color: '#a855f7 #ec4899' })
  }

  const [orgName, setOrgName] = useState(profile.orgName ?? '')
  const [savingOrg, setSavingOrg] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [logoPreview, setLogoPreview] = useState<string | null>(profile.orgLogoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setOrgName(profile.orgName ?? '')
  }, [profile.orgName])

  const handleLogoSelect = (file: File | null) => {
    setLogoError(null)
    setLogoFile(file)
    if (!file) {
      setLogoPreview(profile.orgLogoUrl)
      return
    }
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (PNG, JPEG, WEBP, GIF, SVG or AVIF).')
      setLogoFile(null)
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setLogoError('Logo must be 3 MB or smaller.')
      setLogoFile(null)
      return
    }
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleUploadLogo = async () => {
    if (!logoFile) return
    setUploadingLogo(true)
    setLogoError(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(logoFile)
      })
      await updateOrgLogoFn({
        data: { base64, mime: logoFile.type, size: logoFile.size },
      })
      setLogoFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      navigate({ to: '/dashboard/profile', replace: true })
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      setLogoError(error?.message ?? 'Failed to upload logo. Please try again.')
      setUploadingLogo(false)
    }
  }

  const handleSaveOrgName = async () => {
    setSavingOrg(true)
    try {
      const result = await updateOrgNameFn({ data: { orgName } })
      // Update the profile state with the new orgName
      if (result.ok) {
        // Force reload the route to get updated profile data
        navigate({ to: '/dashboard/profile', replace: true })
      }
    } catch (error) {
      console.error('Error saving organization name:', error)
      alert('Failed to save organization name. Please try again.')
    } finally {
      setSavingOrg(false)
    }
  }

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

  const handleCancelDelete = async () => {
    try {
      await cancelDeleteAccount()
      navigate({ to: '/dashboard/profile', replace: true })
    } catch {
      // ignore
    }
  }

  return (
    <>
      <DashboardHeader />
      <main className="flex-1 bg-[var(--bg-soft)]">
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
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
              <p className="text-xs text-[var(--mutfg)]">
                {sub.active && sub.expiresAt
                  ? <>Expires {new Date(sub.expiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</>
                  : 'Never expired'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
              {sub.active ? 'Active' : 'Free'}
            </span>
          </div>
          <div className="flex flex-wrap justify-around gap-6 py-2">
            {charts.map((c) => (
              <DonutChart
                key={c.label}
                pct={c.pct}
                label={c.label}
                value={c.value}
                subvalue={c.subvalue}
                color={c.color}
              />
            ))}
          </div>
        </div>

        {/* Organization info */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--fg)]">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-[var(--mutfg)]">Organization Name</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSaveOrgName}
                  disabled={savingOrg || (orgName.trim() === '' && !profile.orgName) || orgName === (profile.orgName ?? '')}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingOrg ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <div>
                <div className="text-sm font-bold text-[var(--fg)]">Team Members & Access</div>
                <div className="text-xs text-[var(--mutfg)]">Manage organization members and assign roles.</div>
              </div>
              <Link
                to="/dashboard/members"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-xs font-bold text-[var(--fg)] hover:bg-[var(--muted)] transition-colors"
              >
                Manage Members →
              </Link>
            </div>
          </div>
        </div>

        {/* Organization logo */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <h2 className="mb-4 text-base font-bold text-[var(--fg)]">Logo</h2>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              {logoPreview ? (
                <img src={logoPreview} alt="Organization logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-[var(--mutfg)]">{(orgName ?? 'O').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                  onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
                  className="block w-full max-w-xs text-sm text-[var(--mutfg)] file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white file:hover:bg-blue-700"
                />
                {logoFile && (
                  <button
                    onClick={handleUploadLogo}
                    disabled={uploadingLogo}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--mutfg)]">Upload your organization logo. PNG, JPEG, WEBP, GIF, SVG or AVIF, max 3 MB.</p>
              {logoError && <p className="mt-1 text-xs font-medium text-red-500">{logoError}</p>}
            </div>
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
            <div className="flex justify-between">
              <dt className="text-[var(--mutfg)]">Expires</dt>
              <dd className="font-medium text-[var(--fg)]">
                {sub.active && sub.expiresAt
                  ? new Date(sub.expiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
                  : 'Never expired'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Danger Zone */}
        {deleted ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="mb-2 text-base font-bold text-amber-600">Account Deletion Scheduled</h2>
            <p className="mb-4 text-sm text-[var(--mutfg)]">
              Your account has been scheduled for deletion. All data will be permanently removed after 7 days.
              You can cancel this within the grace period.
            </p>
            <button
              onClick={handleCancelDelete}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              Cancel Deletion
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h2 className="mb-2 text-base font-bold text-red-600">Danger Zone</h2>
            <p className="mb-4 text-sm text-[var(--mutfg)]">
              Removing your account starts a 7-day grace period before all data is permanently erased.
              You can cancel within this period by returning to this page.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              Remove Account
            </button>
          </div>
        )}
      </div>
      </main>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-extrabold text-red-600">Remove Account</h3>
            <p className="mb-4 text-sm text-[var(--mutfg)]">
              This schedules your account for deletion. You have <strong>7 days</strong> to cancel before all data is permanently removed. Type <strong>DELETE</strong> to confirm.
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
