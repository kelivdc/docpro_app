import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getSharedDocumentFn } from '../server/functions/share'

export const Route = createFileRoute('/share/$token')({
  component: ShareViewer,
  head: () => ({
    meta: [{ title: 'DocPro — Shared Document' }],
  }),
})

function ShareViewer() {
  const { token } = Route.useParams()
  const [doc, setDoc] = useState<null | {
    name: string
    category: string | null
    path: string | null
    note: string | null
    mode: string
  }>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    getSharedDocumentFn({ data: { token } })
      .then((res) => {
        setDoc(res ?? null)
        setLoading(false)
      })
      .catch(() => {
        setError('Tautan tidak valid atau kedaluwarsa.')
        setDoc(null)
        setLoading(false)
      })
  }, [token])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col px-6 py-12">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">D</span>
        <span className="text-lg font-extrabold tracking-tight text-[var(--fg)]">DocPro</span>
      </div>

      {loading ? (
        <div className="card-premium p-10 text-center text-sm text-[var(--mutfg)]">Memuat…</div>
      ) : doc === null ? (
        <div className="card-premium p-10 text-center">
          <div className="text-base font-bold text-[var(--fg)]">Tautan tidak tersedia</div>
          <div className="mt-1.5 text-sm text-[var(--mutfg)]">
            {error || 'Knowledge mungkin dihapus, disembunyikan, atau kedaluwarsa.'}
          </div>
        </div>
      ) : (
        <div className="card-premium space-y-4 p-8">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--mutfg)]">Knowledge dibagikan</div>
            <h1 className="mt-1 text-2xl font-extrabold text-[var(--fg)]">{doc.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {doc.category && (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 font-medium text-blue-600">🏷️ {doc.category}</span>
            )}
            {doc.path && (
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 font-medium text-[var(--mutfg)]">📁 {doc.path}</span>
            )}
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600">🔗 {doc.mode}</span>
          </div>
          {doc.note && (
            <p className="whitespace-pre-wrap rounded-xl bg-[var(--muted)] p-4 text-sm text-[var(--fg)]">{doc.note}</p>
          )}
          <p className="text-xs text-[var(--mutfg)]">
            Tautan berbagi hanya menampilkan metadata dokumen (bukan isi/file). Tanya Jawab AI tersedia di akun pemilik.
          </p>
        </div>
      )}
    </main>
  )
}
