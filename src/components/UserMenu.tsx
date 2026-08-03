import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { signOut } from '../lib/auth-client'
import { initials } from '../routes/dashboard'

export function UserMenu({ user }: { user: { name?: string; email?: string } }) {
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
