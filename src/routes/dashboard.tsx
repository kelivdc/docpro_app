import { useState } from 'react'
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
} from '@tanstack/react-router'
import { getSessionFromServer } from '../lib/get-session'
import { DashboardSidebar, initials } from '../components/DashboardSidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { UserMenu } from '../components/UserMenu'
import type { DashboardUsage } from '../server/functions/usage'
import { getDashboardUsage } from '../server/functions/usage'
import { checkAccountBlocked } from '../server/functions/delete-account'

export { initials }
export { SidebarItem } from '../components/DashboardSidebar'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    try {
      const session = await getSessionFromServer()
      if (!session) {
        throw redirect({ to: '/login' })
      }

      const { blocked } = await checkAccountBlocked()
      if (blocked) {
        throw redirect({ to: '/login', search: { blocked } })
      }

      return { session }
    } catch (error: any) {
      if (error instanceof redirect || error?.code === 'redirect') throw error
      const { Sentry } = await import('../lib/sentry')
      Sentry.captureException(error)
      throw error
    }
  },
  loader: async (): Promise<DashboardUsage> => {
    try {
      return await getDashboardUsage()
    } catch (error) {
      console.error('Error loading dashboard usage:', error)
      // Return default values if there's an error
      return {
        tier: 'free',
        storageUsedMb: 0,
        storageTotalMb: 50,
        storagePct: 0,
        tokenUsed: 0,
        tokenTotal: 50000,
        tokenPct: 0,
        topupTotal: 0,
        topupUsed: 0,
        documentCount: 0,
        chatCount: 0,
        recentDocuments: [],
        chatTrend: [],
        deletionScheduled: false,
      }
    }
  },
  head: () => ({
    meta: [{ title: 'DocPro — Dashboard' }],
  }),
  component: DashboardLayout,
})

function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { session } = Route.useRouteContext()
  const user = session.user

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform md:sticky md:top-0 md:self-start md:h-screen md:z-auto md:block ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <DashboardSidebar onClose={() => setMobileOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar: hamburger + DocPro on the left, theme + user on the right */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-1.5 text-[var(--mutfg)] hover:bg-[var(--muted)] hover:text-[var(--fg)]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <Link to="/dashboard" className="text-sm font-bold text-[var(--fg)]">DocPro</Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
