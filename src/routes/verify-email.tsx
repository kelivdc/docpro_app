import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import Logo from '../components/Logo'
import { sendVerificationEmail } from '../lib/auth-client'

export const Route = createFileRoute('/verify-email')({
  validateSearch: (s: Record<string, unknown>): { email?: string; error?: string; status?: string } => ({
    email: typeof s.email === 'string' ? s.email : undefined,
    error: typeof s.error === 'string' ? s.error : undefined,
    status: typeof s.status === 'string' ? s.status : undefined,
  }),
  component: VerifyEmailPage,
  head: () => ({
    meta: [{ title: 'DocPro — Verify Email' }],
  }),
})

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: 'This verification link has expired. Please request a new one.',
  INVALID_TOKEN: 'This verification link is invalid. Please request a new one.',
  USER_NOT_FOUND: 'We could not find an account for this link.',
  EMAIL_MISMATCH: 'This verification link does not match your session.',
  EMAIL_ALREADY_VERIFIED: 'Your email is already verified.',
}

function VerifyEmailPage() {
  const { email = '', error = '', status = '' } = Route.useSearch()
  const [inputEmail, setInputEmail] = useState(email)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')

  const isVerified = status === 'verified'
  const errorMessage = error ? ERROR_MESSAGES[error] || 'Something went wrong with this verification link.' : ''

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setFormError('')
    setSent(false)
    if (!inputEmail.trim() || !inputEmail.includes('@')) {
      setFormError('Please enter a valid email address.')
      return
    }
    setSubmitting(true)
    const { error: err } = await sendVerificationEmail({
      email: inputEmail.trim(),
      callbackURL: '/dashboard',
    })
    setSubmitting(false)
    if (err) {
      setFormError(err.message || 'Failed to send verification email.')
    } else {
      setSent(true)
    }
  }

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
            Verify your email to keep your account secure and unlock full access to DocPro.
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

          <div className="card p-6 sm:p-8 text-center">
            {isVerified ? (
              <>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Email verified</h2>
                <p className="mt-2 text-sm text-[var(--mutfg)]">Your email has been verified. You can now sign in to DocPro.</p>
                <Link to="/login" search={{ blocked: undefined }} className="demo-button mt-6 inline-flex justify-center">
                  Sign In
                </Link>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-blue-500/10 text-blue-600">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
                <p className="mt-2 text-sm text-[var(--mutfg)]">
                  {errorMessage
                    ? errorMessage
                    : 'Enter your email below and we will send you a verification link.'}
                </p>

                <form className="mt-6 space-y-4 text-left" onSubmit={handleSubmit} noValidate>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Email</label>
                    <input
                      type="email"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      placeholder="arie@company.com"
                      className={'demo-input w-full' + (formError ? ' border-red-500' : '')}
                    />
                    {formError && <p className="mt-1.5 text-xs text-red-600">{formError}</p>}
                  </div>

                  <button type="submit" className="demo-button w-full justify-center" disabled={submitting}>
                    {submitting ? 'Sending…' : sent ? 'Sent' : 'Send verification email'}
                  </button>

                  {sent && (
                    <p className="text-center text-xs text-emerald-600">
                      Verification email sent. Check your inbox.
                    </p>
                  )}
                </form>

                <p className="mt-6 text-center text-sm text-[var(--mutfg)]">
                  Already verified?{' '}
                  <Link to="/login" search={{ blocked: undefined }} className="font-semibold text-blue-600 hover:underline">
                    Sign In
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
