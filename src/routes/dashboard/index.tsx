import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { signOut } from '../../lib/auth-client'
import { initials } from '../dashboard'
import { Route as DashboardRoute } from '../dashboard'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
  head: () => ({
    meta: [{ title: 'DocPro — Dashboard' }],
  }),
})

function UserMenu({ user }: { user: { name?: string; email?: string } }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--card-bg)] transition-all hover:bg-[var(--muted)]"
      >
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white">
          {initials(user.name)}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
          <div className="border-b border-[var(--border)] px-3.5 py-3">
            <div className="truncate text-sm font-bold text-[var(--fg)]">{user.name}</div>
            <div className="truncate text-xs text-[var(--mutfg)]">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate({ to: '/dashboard/profile' })
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--muted)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </button>
          <button
            type="button"
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => navigate({ to: '/login' }),
                },
              })
            }
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export function DashboardHeader() {
  const { session } = DashboardRoute.useRouteContext()
  const user = session.user

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-end gap-4 px-6">
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" strokeLinecap="round" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
            </span>
            <input
              className="w-64 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] py-2 pl-9 pr-10 text-sm text-[var(--fg)] placeholder:text-[var(--mutfg)] focus:outline-none lg:w-80"
              placeholder="Search document activity…"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mutfg)]">/</span>
          </div>

          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}

function KpiCard({
  icon,
  accent,
  value,
  label,
  badge,
}: {
  icon: React.ReactNode
  accent: string
  value: string
  label: string
  badge: React.ReactNode
}) {
  return (
    <div className="card-premium flex flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl text-lg font-bold ${accent}`}>{icon}</div>
        {badge}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-extrabold tracking-tight text-[var(--fg)]">{value}</div>
        <div className="mt-1 text-xs font-medium text-[var(--mutfg)]">{label}</div>
      </div>
    </div>
  )
}

function ActivityItem({
  name,
  status,
  tone,
  sub,
}: {
  name: string
  status: string
  tone: 'amber' | 'emerald' | 'blue' | 'rose'
  sub: string
}) {
  const toneCls: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600',
    rose: 'bg-rose-500/10 text-rose-600',
  }
  return (
    <li className="flex items-start gap-3.5 border-b border-[var(--border)]/20 pb-3 last:border-b-0 last:pb-0">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneCls[tone]}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[var(--fg)]">{name}</div>
        <div className="mt-0.5 text-xs text-[var(--mutfg)]">{sub}</div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${toneCls[tone]}`}>{status}</span>
    </li>
  )
}

function DashboardHome() {
  const { session } = DashboardRoute.useRouteContext()
  const usage = DashboardRoute.useLoaderData()
  const user = session.user

  const storageUsed = usage?.storageUsedMb ?? 0
  const storageTotal = usage?.storageTotalMb ?? 150
  const storagePct = usage?.storagePct ?? 0
  const tokenUsed = usage?.tokenUsed ?? 0
  const tokenTotal = usage?.tokenTotal ?? 0
  const tokenPct = usage?.tokenPct ?? 0
  const documentCount = usage?.documentCount ?? 0
  const chatCount = usage?.chatCount ?? 0
  const shareLinkCount = usage?.shareLinkCount ?? 0
  const recentDocuments = usage?.recentDocuments ?? []
  const chatTrend = usage?.chatTrend ?? []
  const tier = usage?.tier ?? 'free'

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan'

  // Build chart path from chatTrend data
  const maxCount = Math.max(1, ...chatTrend.map((d) => d.count))
  const chartW = 700
  const chartH = 180
  const padX = 50
  const padTop = 20
  const padBottom = 40
  const innerW = chartW - padX - 50
  const innerH = chartH - padTop - padBottom
  const stepX = innerW / Math.max(1, chatTrend.length - 1)

  const points = chatTrend.map((d, i) => {
    const x = padX + i * stepX
    const y = padTop + innerH - (d.count / maxCount) * innerH
    return { x, y, ...d }
  })

  const linePath = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : ''
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padTop + innerH} L ${points[0].x} ${padTop + innerH} Z`
    : ''

  const formatToken = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 rounded-2xl bg-[var(--bg-soft)] px-6 py-8">
        {/* Greeting */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--fg)]">
              Welcome back, {user.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="mt-1.5 text-sm text-[var(--mutfg)]">
              Here's your activity, usage, and plan summary for today.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-2 text-xs font-semibold text-[var(--mutfg)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </section>

        {/* KPI Grid */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            accent="bg-blue-500/10 text-blue-600"
            value={`${documentCount}`}
            label="Total Knowledge"
            badge={documentCount > 0 ? <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span> : <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--mutfg)]">Empty</span>}
          />
          <KpiCard
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            accent="bg-indigo-500/10 text-indigo-600"
            value={`${chatCount}`}
            label="Chats (30 days)"
            badge={chatCount > 0 ? <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> Active</span> : <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--mutfg)]">None</span>}
          />
          <KpiCard
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4" /></svg>}
            accent="bg-emerald-500/10 text-emerald-600"
            value={`${storageUsed} MB`}
            label="Storage Used"
            badge={<span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--mutfg)]">quota {storageTotal} MB</span>}
          />
          <KpiCard
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l5.292-3.024M15.22 17.69l-5.29-3.02M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            accent="bg-amber-500/10 text-amber-600"
            value={`${shareLinkCount}`}
            label="Share Links"
            badge={shareLinkCount > 0 ? <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-extrabold text-amber-600">Active</span> : <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--mutfg)]">None</span>}
          />
        </section>

        {/* Chart + Insight */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card-premium flex flex-col justify-between p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--fg)]">Chat Trend</h3>
                <p className="mt-0.5 text-xs text-[var(--mutfg)]">Daily AI chat volume this week</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mutfg)]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> {tierLabel}
              </div>
            </div>
            <div className="relative mt-2 h-48 w-full">
              {chatTrend.every((d) => d.count === 0) ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--mutfg)]">
                  No chat activity yet this week.
                </div>
              ) : (
                <svg className="h-full w-full" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#chartGrad)" />
                  <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="5" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                  ))}
                </svg>
              )}
            </div>
            <div className="mt-2.5 flex justify-between px-4 text-[11px] font-bold text-[var(--mutfg)]">
              {chatTrend.map((d, i) => <span key={i}>{d.label}</span>)}
            </div>
          </div>

          <div className="card-premium relative flex flex-col justify-between overflow-hidden p-6">
            <div className="absolute -right-4 -top-4 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
            <div>
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> AI Insight
              </div>
              <h4 className="text-base font-extrabold leading-tight text-[var(--fg)]">Token Usage</h4>
              <p className="mt-2 text-xs leading-relaxed text-[var(--mutfg)]">
                You've used <span className="font-semibold text-[var(--fg)]">{formatToken(tokenUsed)}</span> tokens this month out of <span className="font-semibold text-[var(--fg)]">{formatToken(tokenTotal)}</span> available.
                {tokenPct > 80
                  ? ' You are approaching your monthly limit — consider upgrading your plan.'
                  : tokenPct < 10 && tokenUsed > 0
                    ? ' You have plenty of tokens remaining.'
                    : ''}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${tokenPct}%` }} />
              </div>
              <div className="mt-1 text-right text-[10px] font-bold text-[var(--mutfg)]">{tokenPct}%</div>
            </div>
            <a href="/dashboard/plans" className="mt-6 flex w-full items-center justify-center gap-1 rounded-xl border border-blue-500/20 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-500/5">
              Upgrade Plan
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          </div>
        </section>

        {/* Plan + Activity */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card-premium flex flex-col overflow-hidden lg:col-span-2">
            <div className="grad-plan flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-[var(--fg)]">{tierLabel}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600">Active</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--mutfg)]">{formatToken(tokenTotal)} tokens / month</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-bold text-[var(--mutfg)]">Storage Quota</div>
                <div className="text-lg font-black text-[var(--fg)]">{storageTotal} <span className="text-xs font-normal text-[var(--mutfg)]">MB</span></div>
              </div>
            </div>

            <div className="flex-1 space-y-6 p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-[var(--mutfg)]">
                      <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" /></svg>
                      File Storage
                    </span>
                    <span className="text-[var(--fg)]">{storageUsed} MB <span className="font-medium text-[var(--mutfg)]">/ {storageTotal} MB</span></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${storagePct}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-[var(--mutfg)]">
                      <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Token Usage
                    </span>
                    <span className="text-[var(--fg)]">{formatToken(tokenUsed)} <span className="font-medium text-[var(--mutfg)]">/ {formatToken(tokenTotal)}</span></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${tokenPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)]/50 pt-4">
                <a href="/dashboard/plans" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Upgrade Your Plan
                </a>
                <a href="/dashboard/profile" className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--fg)] hover:bg-[var(--muted)]">Manage Subscription</a>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card-premium flex flex-col p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--fg)]">Recent Activity</h3>
                <p className="mt-0.5 text-xs text-[var(--mutfg)]">Recently uploaded Knowledge</p>
              </div>
              <a href="/dashboard/documents" className="text-xs font-bold text-blue-600 hover:underline">View all</a>
            </div>
            {recentDocuments.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[var(--mutfg)]">
                No Knowledge uploaded yet.
              </div>
            ) : (
              <ul className="max-h-[260px] flex-1 space-y-4 overflow-y-auto pr-1">
                {recentDocuments.map((doc) => {
                  const tone = doc.status === 'ready' ? 'emerald' : doc.status === 'processing' ? 'amber' : 'rose'
                  const statusLabel = doc.status === 'ready' ? 'Ready' : doc.status === 'processing' ? 'Processing' : 'Error'
                  const timeAgo = getTimeAgo(doc.createdAt)
                  return (
                    <ActivityItem
                      key={doc.id}
                      name={doc.name}
                      status={statusLabel}
                      tone={tone as 'amber' | 'emerald' | 'blue' | 'rose'}
                      sub={`${timeAgo}`}
                    />
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)]/50 pt-6 text-xs text-[var(--mutfg)]">
          <span className="font-medium">© 2026 DocPro · AI Knowledge Platform</span>
          <span className="flex items-center gap-1 font-semibold">
            Need help?
            <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href="#">Contact support
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </span>
        </footer>
      </main>
    </>
  )
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
