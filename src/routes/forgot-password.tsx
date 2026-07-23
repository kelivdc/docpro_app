import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import Logo from '../components/Logo'
import { requestPasswordReset } from '../lib/auth-client'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
  head: () => ({
    meta: [{ title: 'DocPro — Forgot Password' }],
  }),
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!email.trim()) {
      setError('Email wajib diisi')
      return
    }
    if (!EMAIL_RE.test(email)) {
      setError('Format email tidak valid')
      return
    }
    setError('')
    setSubmitting(true)
    await requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    })
    setSubmitting(false)
    setSent(true)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ============ KIRI: Brand panel ============ */}
      <div className="brand-panel relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="blob bg-blue-400 h-96 w-96 -right-20 -top-20" />
        <div className="blob bg-emerald-400 h-72 w-72 -bottom-10 -left-10" />

        <div className="relative flex items-center gap-2.5">
          <Logo height={32} linkTo="/" textClassName="text-lg font-semibold leading-none text-white" />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Tanya apa pun
            <br />
            tentang Knowledge Anda.
          </h1>
          <p className="mt-4 leading-relaxed text-white/80">
            Masuk ke DocPro dan temukan jawaban dari kontrak, tagihan, dan
            kebijakan perusahaan Anda — lengkap dengan kutipan sumber.
          </p>

          <ul className="mt-8 space-y-3">
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <span className="text-sm">Chat AI dengan kutipan sumber akurat</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <span className="text-sm">Data Anda terenkripsi &amp; privat</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
              </div>
              <span className="text-sm">Mendukung Word, PDF, Excel, &amp; teks</span>
            </li>
          </ul>

          <div className="mt-8 max-w-md rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="text-sm font-semibold">Mulai Gratis</div>
            <p className="mt-1 text-sm text-white/80">50 MB penyimpanan · 50rb token/bulan · OCR 50 halaman/bulan · Tanpa kartu kredit.</p>
          </div>
        </div>

        <div className="relative max-w-md rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
          <p className="text-sm italic text-white/90">
            "Hemat 5 jam setiap minggu mencari klausa kontrak. DocPro sekarang jadi asisten wajib tim legal kami."
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-semibold">SW</div>
            <div>
              <div className="text-sm font-medium">Sari Wijaya</div>
              <div className="text-xs text-white/60">Head of Legal · PT Maju</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ KANAN: Form ============ */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo height={30} linkTo="/" textClassName="text-lg font-semibold leading-none text-[var(--fg)]" />
          </div>

          <div className="card p-6 sm:p-8">
            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">Lupa kata sandi?</h2>
              <p className="mt-1 text-sm text-[var(--mutfg)]">
                Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
              </p>
            </div>

            {sent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-[var(--fg)]">
                  Jika email <span className="font-semibold">{email}</span> terdaftar, tautan reset telah dikirim. Periksa kotak masuk Anda.
                </div>
                <Link to="/login" className="demo-button w-full justify-center">
                  Kembali ke masuk
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                    </span>
                    <input
                      type="email"
                      placeholder="arie@perusahaan.id"
                      className={'demo-input has-icon pl-9 pr-3' + (error ? ' border-red-500' : '')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
                </div>

                <button type="submit" className="demo-button w-full justify-center" disabled={submitting}>
                  {submitting ? 'Memproses…' : 'Kirim tautan reset'}
                </button>

                <p className="text-center text-sm text-[var(--mutfg)]">
                  Ingat kata sandi?{' '}
                  <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                    Masuk
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

