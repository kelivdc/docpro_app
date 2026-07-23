import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import Logo from '../components/Logo'
import { signIn, signUp } from '../lib/auth-client'

export const Route = createFileRoute('/register')({
  component: Register,
  head: () => ({
    meta: [{ title: 'DocPro — Register' }],
  }),
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Register() {
  const navigate = useNavigate()
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [agree, setAgree] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!nama.trim()) e.nama = 'Full name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(email)) e.email = 'Invalid email format'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (!konfirmasi) e.konfirmasi = 'Please confirm your password'
    else if (konfirmasi !== password) e.konfirmasi = 'Passwords do not match'
    if (!agree) e.agree = 'You must agree to the Terms & Privacy Policy'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const { error } = await signUp.email(
      {
        email,
        password,
        name: nama,
        callbackURL: '/dashboard',
      },
      {
        onRequest: () => setSubmitting(true),
        onError: (ctx) => {
          setSubmitting(false)
          setErrors({ email: ctx.error.message || 'Registration failed. Please try again.' })
        },
      },
    )

    if (error) return
    navigate({ to: '/dashboard' })
  }

  const pwStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : 3

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ============ LEFT: Brand panel ============ */}
      <div className="brand-panel relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="blob bg-blue-400 h-96 w-96 -right-20 -top-20" />
        <div className="blob bg-emerald-400 h-72 w-72 -bottom-10 -left-10" />

        <div className="relative flex items-center gap-2.5">
          <Logo height={32} linkTo="/" textClassName="text-lg font-semibold leading-none text-white" />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Build your
            <br />
            Knowledge Assistant.
          </h1>
          <p className="mt-4 leading-relaxed text-white/80">
            Create a free account in 2 minutes. Upload contracts, invoices, and policies —
            then ask anything with sourced answers.
          </p>

          <ul className="mt-8 space-y-3">
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <span className="text-sm">AI Chat with accurate source citations</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <span className="text-sm">Your data is encrypted &amp; private</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
              </div>
              <span className="text-sm">Supports Word, PDF, Excel, &amp; text</span>
            </li>
          </ul>

          <div className="mt-8 max-w-md rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-sm font-semibold">Start Free</div>
            <p className="mt-1 text-sm text-white/80">50 MB storage · 50k tokens · OCR 50 pages · No credit card.</p>
          </div>
        </div>

      </div>

      {/* ============ RIGHT: Form ============ */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo height={30} linkTo="/" textClassName="text-lg font-semibold leading-none text-[var(--fg)]" />
          </div>

          <div className="card p-6 sm:p-8">
            {/* Tabs */}
            <div className="mb-6 inline-flex w-full rounded-lg bg-[var(--muted)] p-0.5 text-sm">
              <Link to="/login" className="flex-1 rounded-md px-3 py-2 text-center text-[var(--fg-soft)]">
                Sign In
              </Link>
              <button className="seg-active flex-1 rounded-md px-3 py-2 text-center font-medium">Register</button>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">Create free account</h2>
              <p className="mt-1 text-sm text-[var(--mutfg)]">Start managing your Knowledge with AI in 2 minutes.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <button
                type="button"
                className="demo-button demo-button-secondary w-full justify-center gap-2.5"
                onClick={() => {
                  signIn.social({
                    provider: 'google',
                    callbackURL: '/dashboard',
                  })
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
                </svg>
                Register with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs text-[var(--mutfg)]">or register with email</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Full name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Full name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Arie Pratama"
                    className={'demo-input has-icon pl-9 pr-3' + (errors.nama ? ' border-red-500' : '')}
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                  />
                </div>
                {errors.nama && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.nama}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Email <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  </span>
                  <input
                    type="email"
                    placeholder="arie@company.com"
                    className={'demo-input has-icon pl-9 pr-3' + (errors.email ? ' border-red-500' : '')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Password <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className={'demo-input has-icon pl-9 pr-10' + (errors.password ? ' border-red-500' : '')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)] hover:text-[var(--fg)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1.5">
                      <span className={'h-1 flex-1 rounded-full ' + (pwStrength >= 1 ? 'bg-emerald-500' : 'bg-[var(--border)]')} />
                      <span className={'h-1 flex-1 rounded-full ' + (pwStrength >= 2 ? 'bg-emerald-500' : 'bg-[var(--border)]')} />
                      <span className={'h-1 flex-1 rounded-full ' + (pwStrength >= 3 ? 'bg-emerald-500' : 'bg-[var(--border)]')} />
                      <span className={'h-1 flex-1 rounded-full ' + (pwStrength >= 4 ? 'bg-emerald-500' : 'bg-[var(--border)]')} />
                    </div>
                    <p className="mt-1.5 text-[var(--mutfg)]" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                      Use at least 8 characters, mix of letters &amp; numbers.
                    </p>
                  </div>
                )}
                {errors.password && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password}</p>}
              </div>

              {/* Confirm password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Confirm password <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Repeat password"
                    className={'demo-input has-icon pl-9 pr-10' + (errors.konfirmasi ? ' border-red-500' : '')}
                    value={konfirmasi}
                    onChange={(e) => setKonfirmasi(e.target.value)}
                  />
                  {konfirmasi && konfirmasi === password && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                  )}
                </div>
                {errors.konfirmasi && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.konfirmasi}</p>}
              </div>

              {/* Agreement */}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--fg-soft)]">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--line)]"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>
                  I agree to{' '}
                  <a className="text-blue-600 dark:text-blue-400 hover:underline" href="/terms">
                    Terms of Service
                  </a>{' '}
                  &amp;{' '}
                  <a className="text-blue-600 dark:text-blue-400 hover:underline" href="/privacy">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {errors.agree && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.agree}</p>}

              <button type="submit" className="demo-button w-full justify-center" disabled={submitting}>
                {submitting ? 'Processing…' : 'Register Free'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--mutfg)]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400">
              Sign In
            </Link>
          </p>
          <p className="mt-6 text-center text-[13px] text-[var(--mutfg)]">
            We never share your data to train public AI models.
          </p>
        </div>
      </div>
    </div>
  )
}
