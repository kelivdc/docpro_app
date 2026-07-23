import { Link, useLocation } from '@tanstack/react-router'
import Logo from './Logo'

const linkClass = 'rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200'
const linkInactive = 'text-[var(--mutfg)] hover:bg-[var(--muted)] hover:text-[var(--fg)]'
const linkActive = 'bg-[var(--muted)] text-[var(--fg)]'

function NavLink({ to, children, isActive }: { to: string; children: string; isActive?: boolean }) {
  const className = `${linkClass} ${isActive ? linkActive : linkInactive}`
  return <Link className={className} to={to}>{children}</Link>
}

export default function Header() {
  const { pathname } = useLocation()

  const routes = [
    { to: '/features', label: 'Features' },
    { to: '/how-it-works', label: 'How it works' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/faq', label: 'FAQ' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg transition-colors duration-300">
      <nav className="page-wrap mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6">
        <Logo height={30} linkTo="/" />

        <div className="hidden items-center gap-1.5 lg:flex">
          {routes.map((r) => (
            <NavLink key={r.to} to={r.to} isActive={pathname === r.to}>{r.label}</NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            className="hidden px-3 py-2 text-sm font-medium text-[var(--mutfg)] transition-colors hover:text-[var(--fg)] sm:block"
            href="/login"
          >
            Sign in
          </a>
          <a
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4.5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/10 transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25"
            style={{ color: '#fff' }}
            href="/register"
          >
            Get started free
          </a>
        </div>
      </nav>
    </header>
  )
}
