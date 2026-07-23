import Logo from './Logo'

export default function Footer() {
  const produk = [
    { label: 'Features', to: '/features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'How it Works', to: '/how-it-works' },
  ]

  const perusahaan = [
    { label: 'About Us', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ]

  const legal = [
    { label: 'Terms of Service', to: '/terms' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Security', to: '/security' },
    { label: 'SLA', to: '/sla' },
    { label: 'Subprocessors', to: '/subprocessors' },
    { label: 'DPA', to: '/dpa' },
  ]

  return (
    <footer className="border-t border-[var(--border)] px-4 pb-10 pt-16 transition-colors duration-300" style={{ background: 'color-mix(in oklab, var(--muted) 40%, transparent)' }}>
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-4 space-y-4 text-left">
            <div className="flex items-center gap-2.5">
              <Logo height={28} textClassName="text-lg font-extrabold tracking-tight text-[var(--fg)]" />
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--mutfg)]">
              AI Knowledge Platform that turns your documents into structured knowledge
              and distributes it across every channel your audience needs — websites,
              chat apps, APIs, and AI agents.
            </p>
          </div>

          <div className="col-span-1 md:col-span-2 text-left">
            <h5 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[var(--mutfg)]">
              Product
            </h5>
            <ul className="space-y-2.5 text-xs">
              {produk.map((l) => (
                <li key={l.label}>
                  <a href={l.to} className="text-[var(--fg)] no-underline transition hover:text-blue-600 dark:hover:text-blue-400">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2 text-left">
            <h5 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[var(--mutfg)]">
              Company
            </h5>
            <ul className="space-y-2.5 text-xs">
              {perusahaan.map((l) => (
                <li key={l.label}>
                  <a href={l.to} className="text-[var(--fg)] no-underline transition hover:text-blue-600 dark:hover:text-blue-400">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-4 text-left">
            <h5 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[var(--mutfg)]">
              Legal
            </h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {legal.map((l) => (
                <a
                  key={l.label}
                  href={l.to}
                  className="text-[var(--fg)] no-underline transition hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-[11px] text-[var(--mutfg)] sm:flex-row">
          <span>&copy; 2026 DocPro. All rights reserved.</span>
          <div className="flex items-center gap-5 font-semibold">
            <a href="#" className="no-underline transition hover:text-[var(--fg)]">Twitter</a>
            <a href="#" className="no-underline transition hover:text-[var(--fg)]">LinkedIn</a>
            <a href="#" className="no-underline transition hover:text-[var(--fg)]">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
