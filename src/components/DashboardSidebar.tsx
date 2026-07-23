import { Link } from '@tanstack/react-router'
import Logo from './Logo'

export function initials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const ACTIVE_CLS = 'bg-blue-500/10 text-blue-600 font-semibold'
const INACTIVE_CLS =
  'text-[var(--mutfg)] hover:bg-[var(--muted)] hover:text-[var(--fg)]'

export function SidebarItem({
  icon,
  label,
  to,
  end,
  collapsed,
}: {
  icon: React.ReactNode
  label: string
  to?: string
  end?: boolean
  collapsed?: boolean
}) {
  const base = collapsed
    ? 'flex items-center justify-center rounded-xl p-2.5 text-sm transition-all group '
    : 'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all group '
  if (to) {
    return (
      <Link
        to={to}
        activeOptions={{ exact: end }}
        className={base + INACTIVE_CLS}
        activeProps={{ className: base + ACTIVE_CLS }}
        title={collapsed ? label : undefined}
      >
        <span className="shrink-0">{icon}</span>
        {!collapsed && label}
      </Link>
    )
  }
  return <a href="#" className={base + INACTIVE_CLS}>{collapsed ? <span className="shrink-0">{icon}</span> : label}</a>
}

const NAV_ITEMS: { to: string; label: string; end?: boolean; icon: React.ReactNode }[] = [
  {
    to: '/dashboard',
    label: 'Home',
    end: true,
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  },
  {
    to: '/dashboard/files',
    label: 'Upload Knowledge',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>,
  },
  {
    to: '/dashboard/documents',
    label: 'Knowledge Sources',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    to: '/dashboard/chat',
    label: 'AI Chat',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  },
  {
    to: '/dashboard/share',
    label: 'Share Links',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l5.292-3.024M15.22 17.69l-5.29-3.02M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  },
  {
    to: '/dashboard/categories',
    label: 'Categories',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 0 1 2 2v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2zM9 11h6M9 15h4" /></svg>,
  },
  {
    to: '/dashboard/plans',
    label: 'Upgrade',
    icon: <svg className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  },
]

export function DashboardSidebar({
  collapsed,
  onToggle,
}: {
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <aside
      className={`sticky top-0 hidden h-screen md:flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <Logo height={30} linkTo="/" />}
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-[var(--mutfg)] hover:bg-[var(--muted)] hover:text-[var(--fg)]"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto text-sm">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              end={item.end}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>
    </aside>
  )
}
