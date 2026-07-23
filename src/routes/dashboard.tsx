import { useState } from 'react'
import {
  createFileRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { getSessionFromServer } from '../lib/get-session'
import { DashboardSidebar, initials } from '../components/DashboardSidebar'
import type { DashboardUsage } from '../server/functions/usage'
import { getDashboardUsage } from '../server/functions/usage'

export { initials }
export { SidebarItem } from '../components/DashboardSidebar'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await getSessionFromServer()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async (): Promise<DashboardUsage> => {
    return getDashboardUsage()
  },
  head: () => ({
    meta: [{ title: 'DocPro — Dashboard' }],
  }),
  component: DashboardLayout,
})

function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* ============ CONTENT (nested routes render here) ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
