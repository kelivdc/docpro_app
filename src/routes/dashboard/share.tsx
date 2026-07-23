import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import {
  listSharesFn,
  listOwnDocuments,
  createShareFn,
  revokeShareFn,
  type ShareView,
} from '../../server/functions/share'

export const Route = createFileRoute('/dashboard/share')({
  component: SharePage,
  head: () => ({
    meta: [{ title: 'DocPro — Share' }],
  }),
})

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

function SharePage() {
  const [shares, setShares] = useState<{ owned: ShareView[]; sharedWithMe: ShareView[] }>({ owned: [], sharedWithMe: [] })
  const [docs, setDocs] = useState<{ id: string; name: string; category: string | null }[]>([])
  const [docId, setDocId] = useState('')
  const [mode, setMode] = useState('public')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  const [page, setPage] = useState(1)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null)
  const [tab, setTab] = useState<'owned' | 'sharedWithMe'>('owned')
  const perPage = 10

  const showCopied = (url: string) => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopied(url)
    copyTimer.current = setTimeout(() => setCopied(''), 3000)
  }

  const load = async () => {
    try {
      const [res, ownDocs] = await Promise.all([listSharesFn(), listOwnDocuments()])
      setShares(res as { owned: ShareView[]; sharedWithMe: ShareView[] })
      setDocs(ownDocs as { id: string; name: string; category: string | null }[])
      if (!docId && (ownDocs as unknown[]).length) setDocId((ownDocs as { id: string }[])[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    setError('')
    if (!docId) {
      setError('Select Knowledge first')
      return
    }
    setBusy(true)
    try {
      const res = (await createShareFn({ data: { documentId: docId, mode } })) as { token: string }
      const url = `${APP_URL}/share/${res.token}`
      await navigator.clipboard.writeText(url).catch(() => {})
      showCopied(url)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create link')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await revokeShareFn({ data: { id } })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke')
    }
  }

  const activeShares = tab === 'owned' ? shares.owned : shares.sharedWithMe

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 rounded-2xl bg-[var(--bg-soft)] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Share Links</h1>
          <p className="mt-1.5 text-sm text-[var(--mutfg)]">
            Create links to share Knowledge. Links show metadata (not file content).
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="card-premium mb-6 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Document</label>
            <select value={docId} onChange={(e) => setDocId(e.target.value)} className="demo-input w-full">
              {docs.length === 0 && <option value="">No documents yet</option>}
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Share mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="demo-input w-full">
              <option value="public">Public — anyone with the link</option>
              <option value="user">Specific users (Enterprise)</option>
              <option value="departemen">Department (Enterprise)</option>
            </select>
            <p className="mt-1.5 text-xs text-[var(--mutfg)]">
              User/department modes are fully enforced on Business/Enterprise plans. On Free/Personal, links are public.
            </p>
          </div>
          <button
            onClick={create}
            disabled={busy || docs.length === 0}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create link & copy'}
          </button>
          {copied && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <span className="min-w-0 truncate text-xs text-emerald-700">
                Copied:{' '}
                <a
                  href={copied}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline underline-offset-2 hover:text-emerald-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  {copied}
                </a>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(copied).catch(() => {})
                  showCopied(copied)
                }}
                className="shrink-0 rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                title="Copy again"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              </button>
            </div>
          )}
        </div>

        <section>
          <div className="mb-4 flex gap-1 rounded-xl bg-[var(--muted)] p-1">
            <button
              onClick={() => { setTab('owned'); setPage(1) }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                tab === 'owned' ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-sm' : 'text-[var(--mutfg)] hover:text-[var(--fg)]'
              }`}
            >
              Owned by me ({shares.owned.length})
            </button>
            <button
              onClick={() => { setTab('sharedWithMe'); setPage(1) }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                tab === 'sharedWithMe' ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-sm' : 'text-[var(--mutfg)] hover:text-[var(--fg)]'
              }`}
            >
              Shared with me ({shares.sharedWithMe.length})
            </button>
          </div>

          {loading ? (
            <div className="card-premium p-6 text-sm text-[var(--mutfg)]">Loading…</div>
          ) : activeShares.length === 0 ? (
            <div className="card-premium p-6 text-sm text-[var(--mutfg)]">
              {tab === 'owned' ? 'No share links yet.' : 'No links shared with you.'}
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--mutfg)]">
                    <th className="px-4 py-3 md:px-5">Document</th>
                    <th className="hidden px-4 py-3 md:table-cell md:px-5">URL</th>
                    <th className="px-4 py-3 md:px-5">Mode</th>
                    <th className="hidden px-4 py-3 sm:table-cell md:px-5">Created</th>
                    <th className="px-4 py-3 text-right md:px-5">{tab === 'owned' ? 'Action' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeShares.slice((page - 1) * perPage, page * perPage).map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50">
                      <td className="max-w-0 px-4 py-3 md:px-5">
                        <div className="truncate font-medium text-[var(--fg)]">{s.documentName}</div>
                      </td>
                      <td className="hidden max-w-0 px-4 py-3 md:table-cell md:px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-xs text-[var(--mutfg)]">
                            {APP_URL}/share/{s.token}
                          </span>
                          <button
                            onClick={() => {
                              const url = `${APP_URL}/share/${s.token}`
                              navigator.clipboard.writeText(url).catch(() => {})
                              showCopied(url)
                            }}
                            className="shrink-0 rounded-md p-1 text-[var(--mutfg)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--fg)]"
                            title="Copy link"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 md:px-5">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">{s.mode}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-[var(--mutfg)] sm:table-cell md:px-5">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right md:px-5">
                        {tab === 'owned' && (
                          <button
                            onClick={() => setRevokeTarget({ id: s.id, name: s.documentName })}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeShares.length > perPage && (
                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 md:px-5">
                  <span className="text-xs text-[var(--mutfg)]">
                    {Math.min((page - 1) * perPage + 1, activeShares.length)}–{Math.min(page * perPage, activeShares.length)} of {activeShares.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.ceil(activeShares.length / perPage) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          p === page ? 'bg-blue-600 text-white' : 'border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--muted)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(Math.ceil(activeShares.length / perPage), p + 1))}
                      disabled={page === Math.ceil(activeShares.length / perPage)}
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-extrabold text-red-600">Revoke Share Link</h3>
            <p className="mb-4 text-sm text-[var(--mutfg)]">
              Are you sure you want to revoke the link for <strong>{revokeTarget.name}</strong>? Anyone with this link will lose access.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeTarget(null)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] py-2.5 text-sm font-bold text-[var(--fg)] transition-colors hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
              <button
                onClick={() => { revoke(revokeTarget.id); setRevokeTarget(null) }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
