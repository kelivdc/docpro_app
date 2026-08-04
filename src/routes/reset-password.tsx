import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import Logo from '../components/Logo'
import { resetPassword } from '../lib/auth-client'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (s: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof s.token === 'string' ? s.token : undefined,
    error: typeof s.error === 'string' ? s.error : undefined,
  }),
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: 'DocPro — Reset Password' }],
  }),
})

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: 'This reset link is invalid or has expired. Please request a new one.',
}

export default function ResetPasswordPage() {
  const { token, error: queryError } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    const { error: err } = await resetPassword({ newPassword: password, token })
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } else {
      setDone(true)
    }
  }

  const displayError = queryError ? ERROR_MESSAGES[queryError] || 'This reset link is invalid.' : error

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
            Secure your
            <br />
            Knowledge Assistant.
          </h1>
          <p className="mt-4 leading-relaxed text-white/80">
            Choose a strong password to keep your DocPro account safe.
          </p>
        </div>

        <div className="relative text-sm text-white/60">
          © {new Date().getFullYear()} DocPro. All rights reserved.
        </div>
      </div>

      {/* ============ RIGHT: Form ============ */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo height={30} linkTo="/" textClassName="text-lg font-semibold leading-none text-[var(--fg)]" />
          </div>

          <div className="card p-6 sm:p-8">
            {done ? (
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Password reset</h2>
                <p className="mt-2 text-sm text-[var(--mutfg)]">Your password has been updated. Sign in with your new password.</p>
                <Link to="/login" search={{ blocked: undefined }} className="demo-button mt-6 inline-flex justify-center">
                  Sign In
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
                  <p className="mt-1 text-sm text-[var(--mutfg)]">Enter a new password for your account.</p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                  {displayError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-medium text-red-600">
                      {displayError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                      New password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        className={'demo-input w-full' + (error && !password ? ' border-red-500' : '')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                      Confirm password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        placeholder="Repeat password"
                        className={'demo-input w-full' + (error && password !== confirm ? ' border-red-500' : '')}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--fg-soft)]">
                    <input
                      type="checkbox"
                      checked={showPw}
                      onChange={(e) => setShowPw(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--line)]"
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>Show password</span>
                  </label>

                  <button type="submit" className="demo-button w-full justify-center" disabled={submitting || !token}>
                    {submitting ? 'Saving…' : 'Reset password'}
                  </button>

                  <p className="text-center text-sm text-[var(--mutfg)]">
                    Remember your password?{' '}
                    <Link to="/login" search={{ blocked: undefined }} className="font-semibold text-blue-600 hover:underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
