import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import {
  listDocuments,
  deleteDocument,
  toggleHiddenDocument,
  downloadDocumentUrl,
  reprocessDocument,
} from '../../server/functions/upload'
import { listCategories } from '../../server/functions/categories'

type DocRow = {
  id: string
  name: string
  category: string | null
  path: string | null
  share: string
  hidden: boolean
  expired: boolean
  expiredAt: string | Date | null
  status: string
  error?: string | null
  sizeBytes: number
  mime: string | null
  createdAt: string | Date
  intelligenceScore?: {
    overall?: number
    structureDetection?: number
    headingDetection?: number
    tableDetection?: number
    ocrConfidence?: number
    metadataCompleteness?: number
    usedFallback?: boolean
  } | null
}

const PAGE_SIZE = 8

const CATEGORY_PALETTE: Record<string, string> = {
  Contract: 'blue',
  Invoice: 'emerald',
  HR: 'amber',
  Finance: 'red',
}

function catTone(cat: string | null): string {
  if (!cat) return 'mutfg'
  return CATEGORY_PALETTE[cat] ?? 'indigo'
}

function formatBytes(n: number): string {
  if (!n) return '0 KB'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fileEmoji(name: string): string {
  const l = name.toLowerCase()
  if (l.endsWith('.pdf')) return '📕'
  if (l.endsWith('.doc') || l.endsWith('.docx')) return '📘'
  if (l.endsWith('.xls') || l.endsWith('.xlsx')) return '📗'
  return '📄'
}

function statusBadge(d: DocRow) {
  if (d.status === 'processing')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Processing
      </span>
    )
  if (d.status === 'ready')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Ready
      </span>
    )
  if (d.status === 'error')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Failed
      </span>
    )
  return null
}

// Document Intelligence Score badge (overall parsing/structure quality).
function intelligenceBadge(d: DocRow) {
  const s = d.intelligenceScore
  if (!s || typeof s.overall !== 'number') return null
  const tone =
    s.overall >= 90
      ? 'emerald'
      : s.overall >= INTELLIGENCE_THRESHOLD
        ? 'blue'
        : 'amber'
  const color =
    tone === 'emerald'
      ? 'text-emerald-600 bg-emerald-500/10'
      : tone === 'blue'
        ? 'text-blue-600 bg-blue-500/10'
        : 'text-amber-600 bg-amber-500/10'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
      title={`Structure ${s.structureDetection ?? '-'}% · Heading ${s.headingDetection ?? '-'}% · Table ${s.tableDetection ?? '-'}% · OCR ${s.ocrConfidence ?? '-'}% · Metadata ${s.metadataCompleteness ?? '-'}%`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> IQ {s.overall}%
      {s.usedFallback ? ' · fallback' : ''}
    </span>
  )
}

const INTELLIGENCE_THRESHOLD = 80

export const Route = createFileRoute('/dashboard/documents')({
  component: DocumentsPage,
  head: () => ({
    meta: [{ title: 'DocPro — Document Quality' }],
  }),
})

function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [categories, setCategories] = useState<{ name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [formatFilter, setFormatFilter] = useState<string[]>([])
  const [sort, setSort] = useState<'newest' | 'name'>('newest')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const navigate = useNavigate()

  const refresh = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [rows, cats] = await Promise.all([listDocuments(), listCategories()])
      setDocs(rows as DocRow[])
      setCategories(cats.categories as unknown as { name: string }[])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load document list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const isExpired = (d: DocRow) =>
    d.expired || (d.expiredAt ? new Date(d.expiredAt) <= new Date() : false)

  const filtered = useMemo(() => {
    let list = docs.filter((d) => {
      if (query) {
        const q = query.toLowerCase()
        const hay = `${d.name} ${d.path ?? ''} ${d.category ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (catFilter.length && !catFilter.includes(d.category ?? '—')) return false
      if (statusFilter.length) {
        const s = d.status === 'ready' ? 'Ready' : d.status === 'processing' ? 'Queued' : 'Failed'
        if (!statusFilter.includes(s)) return false
      }
      if (formatFilter.length) {
        const ext = '.' + (d.name.split('.').pop() ?? '').toLowerCase()
        if (!formatFilter.includes(ext)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return list
  }, [docs, query, catFilter, statusFilter, formatFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const allSelectedOnPage = pageRows.length > 0 && pageRows.every((d) => selected.has(d.id))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelectedOnPage) pageRows.forEach((d) => next.delete(d.id))
      else pageRows.forEach((d) => next.add(d.id))
      return next
    })
  }

  const counts = useMemo(() => {
    const byCat = new Map<string, number>()
    const byStatus = { Ready: 0, Queued: 0, Failed: 0 }
    const byFmt = new Map<string, number>()
    for (const d of docs) {
      const c = d.category ?? '—'
      byCat.set(c, (byCat.get(c) ?? 0) + 1)
      if (d.status === 'ready') byStatus.Ready++
      else if (d.status === 'processing') byStatus.Queued++
      else byStatus.Failed++
      const ext = '.' + (d.name.split('.').pop() ?? '').toLowerCase()
      byFmt.set(ext, (byFmt.get(ext) ?? 0) + 1)
    }
    return { byCat, byStatus, byFmt }
  }, [docs])

  const catList = categories.map((c) => c.name)

  const doDelete = async (id: string, name: string) => {
    setConfirmDelete({ id, name })
    setMenuFor(null)
  }

  const executeDelete = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setBusy(id)
    setConfirmDelete(null)
    try {
      await deleteDocument({ data: { id } })
      setSelected((p) => {
        const n = new Set(p)
        n.delete(id)
        return n
      })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const executeBulkDelete = async () => {
    setConfirmBulkDelete(false)
    setBusy('__bulk__')
    for (const id of selected) {
      await deleteDocument({ data: { id } }).catch(() => {})
    }
    setSelected(new Set())
    await refresh()
    setBusy(null)
  }

  const doToggleHidden = async (d: DocRow) => {
    setBusy(d.id)
    try {
      await toggleHiddenDocument({ data: { id: d.id, hidden: !d.hidden } })
      await refresh()
    } finally {
      setBusy(null)
      setMenuFor(null)
    }
  }

  const doDownload = async (id: string) => {
    setBusy(id)
    try {
      const res = await downloadDocumentUrl({ data: { id } })
      window.open(res.url, '_blank')
    } catch {
      /* ignore */
    } finally {
      setBusy(null)
      setMenuFor(null)
    }
  }

  const doReprocess = async (id: string) => {
    setBusy(id)
    setMenuFor(null)
    try {
      await reprocessDocument({ data: { id } })
      await refresh()
    } catch {
      /* toast handled by UI */
    } finally {
      setBusy(null)
    }
  }

  const openEdit = (d: DocRow) => {
    setMenuFor(null)
    navigate({ to: '/dashboard/files', search: { edit: d.id } })
  }

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 rounded-2xl bg-[var(--bg-soft)] px-6 py-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">My Knowledge</h1>
            <p className="mt-1 text-sm text-[var(--mutfg)]">
              {docs.length} documents · manage, filter, and search your Knowledge
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mutfg)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-2 pl-9 pr-3 text-sm placeholder:text-[var(--mutfg)] focus:outline-none"
              placeholder="Search Knowledge, path, or content…"
            />
          </div>
          <button
            onClick={() => {
              setQuery('')
              setCatFilter([])
              setStatusFilter([])
              setFormatFilter([])
              setPage(0)
            }}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)]"
          >
            Reset
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'name')}
            className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-medium focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
          <div className="inline-flex gap-0.5 rounded-lg bg-[var(--muted)] p-0.5">
            <button
              onClick={() => setView('list')}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === 'list' ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-sm' : 'text-[var(--mutfg)]'}`}
              title="List"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <button
              onClick={() => setView('grid')}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === 'grid' ? 'bg-[var(--card-bg)] text-[var(--fg)] shadow-sm' : 'text-[var(--mutfg)]'}`}
              title="Grid"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {/* Filter sidebar */}
          <div className="lg:col-span-1">
            <div className="card-premium sticky top-20 space-y-5 p-4">
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--mutfg)]">Category</h3>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--muted)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)]"
                      checked={catFilter.length === 0}
                      onChange={() => setCatFilter([])}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span className="flex-1">All</span>
                    <span className="text-xs text-[var(--mutfg)]">{docs.length}</span>
                  </label>
                  {catList.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--border)]"
                        checked={catFilter.includes(c)}
                        onChange={() => {
                          setCatFilter((p) => toggleArr(p, c))
                          setPage(0)
                        }}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="flex flex-1 items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full bg-${catTone(c)}-600`} />
                        {c}
                      </span>
                      <span className="text-xs text-[var(--mutfg)]">{counts.byCat.get(c) ?? 0}</span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--muted)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)]"
                      checked={catFilter.includes('—')}
                      onChange={() => {
                        setCatFilter((p) => toggleArr(p, '—'))
                        setPage(0)
                      }}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                      <span className="flex flex-1 items-center gap-1.5 text-[var(--mutfg)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--mutfg)]" /> No category
                    </span>
                    <span className="text-xs text-[var(--mutfg)]">{counts.byCat.get('—') ?? 0}</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--mutfg)]">Status</h3>
                <div className="space-y-1.5">
                  {(['Ready', 'Queued', 'Failed'] as const).map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--border)]"
                        checked={statusFilter.includes(s)}
                        onChange={() => {
                          setStatusFilter((p) => toggleArr(p, s))
                          setPage(0)
                        }}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="flex-1">{s === 'Queued' ? 'Queued for index' : s === 'Ready' ? 'Searchable' : 'Failed'}</span>
                      <span className={`text-xs ${s === 'Ready' ? 'text-emerald-600' : s === 'Queued' ? 'text-amber-600' : 'text-red-600'}`}>
                        {s === 'Ready' ? counts.byStatus.Ready : s === 'Queued' ? counts.byStatus.Queued : counts.byStatus.Failed}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--mutfg)]">Format</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['.pdf', '.docx', '.xlsx', '.txt'].map((ext) => {
                    const active = formatFilter.includes(ext)
                    return (
                      <button
                        key={ext}
                        onClick={() => {
                          setFormatFilter((p) => toggleArr(p, ext))
                          setPage(0)
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          active ? 'border-[var(--primary)] bg-blue-500/10 text-blue-600' : 'border-[var(--border)] text-[var(--mutfg)] hover:bg-[var(--muted)]'
                        }`}
                      >
                        {ext.replace('.', '').toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-3">
            <div className="card-premium overflow-visible">
              {loadError && (
                <div className="flex items-center justify-between gap-3 rounded-t-[20px] border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  <span>{loadError}</span>
                  <button onClick={refresh} className="text-xs font-medium underline hover:opacity-80">Retry</button>
                </div>
              )}
              {selected.size > 0 && (
                <div className="flex items-center gap-3 rounded-t-[20px] border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2.5">
                  <span className="text-xs text-[var(--mutfg)]">{selected.size} selected</span>
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
                  >
                    Delete selected
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="ml-auto text-xs text-[var(--mutfg)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {view === 'list' ? (
                <>
                  <div className="grid grid-cols-12 gap-3 rounded-t-[20px] border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--mutfg)]">
                    <div className="col-span-5 flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" checked={allSelectedOnPage} onChange={toggleSelectAll} style={{ accentColor: 'var(--primary)' }} />
                      Name
                    </div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {pageRows.map((d) => {
                      const exp = isExpired(d)
                      return (
                        <div key={d.id} className="group grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]">
                          <div className="col-span-5 flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 shrink-0 rounded border-[var(--border)]"
                              checked={selected.has(d.id)}
                              onChange={() =>
                                setSelected((p) => {
                                  const n = new Set(p)
                                  if (n.has(d.id)) n.delete(d.id)
                                  else n.add(d.id)
                                  return n
                                })
                              }
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-base">{fileEmoji(d.name)}</div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--fg)]">{d.name}</div>
                              <div className="truncate font-mono text-xs text-[var(--mutfg)]">{d.path ?? '—'}</div>
                            </div>
                          </div>
                          <div className="col-span-2">
                            {d.category ? (
                              <span className={`rounded-full bg-${catTone(d.category)}-500/10 px-2 py-0.5 text-xs font-medium text-${catTone(d.category)}-600`}>{d.category}</span>
                            ) : (
                              <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--mutfg)]">—</span>
                            )}
                          </div>
                          <div className="col-span-2 text-sm text-[var(--mutfg)]">{formatBytes(d.sizeBytes)}</div>
                           <div className="col-span-2 flex flex-wrap items-center gap-1">
                             {statusBadge(d)}
                             {intelligenceBadge(d)}
                             {exp && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">Expired</span>}
                            {d.hidden && <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--mutfg)]">Hidden</span>}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <div className="relative">
                              <button
                                onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                                disabled={busy === d.id}
                                className="grid h-8 w-8 place-items-center rounded-md text-[var(--mutfg)] hover:bg-[var(--card-bg)]"
                              >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                              </button>
                              {menuFor === d.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-lg">
                                     <button onClick={() => openEdit(d)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Edit</button>
                            <button onClick={() => doReprocess(d.id)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Reprocess</button>
                            <button onClick={() => doDownload(d.id)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Download</button>
                            <button onClick={() => doToggleHidden(d)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">
                              {d.hidden ? 'Show' : 'Hide'}
                            </button>
                            <button onClick={() => doDelete(d.id, d.name)} className="block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-500/10">Delete</button>
                                    </div>
                                </>
                              )}
                            </div>
                          </div>
                          {d.status === 'error' && d.error && (
                            <div className="col-span-12 mt-1 text-xs text-red-600">{d.error}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pageRows.map((d) => {
                    const exp = isExpired(d)
                    return (
                      <div key={d.id} className="card-premium relative flex flex-col gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-xl">{fileEmoji(d.name)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--fg)]">{d.name}</div>
                            <div className="truncate font-mono text-xs text-[var(--mutfg)]">{d.path ?? '—'}</div>
                          </div>
                          <button onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--mutfg)] hover:bg-[var(--muted)]">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {d.category && <span className={`rounded-full bg-${catTone(d.category)}-500/10 px-2 py-0.5 text-xs font-medium text-${catTone(d.category)}-600`}>{d.category}</span>}
                           {statusBadge(d)}
                           {intelligenceBadge(d)}
                           {exp && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">Expired</span>}
                           {d.hidden && <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--mutfg)]">Hidden</span>}
                        </div>
                        <div className="text-xs text-[var(--mutfg)]">{formatBytes(d.sizeBytes)}</div>
                        {menuFor === d.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-3 top-12 z-20 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-lg">
                              <button onClick={() => openEdit(d)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Edit</button>
                               <button onClick={() => doReprocess(d.id)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Reprocess</button>
                               <button onClick={() => doDownload(d.id)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">Download</button>
                               <button onClick={() => doToggleHidden(d)} className="block w-full px-3.5 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--muted)]">
                                 {d.hidden ? 'Show' : 'Hide'}
                               </button>
                               <button onClick={() => doDelete(d.id, d.name)} className="block w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-500/10">Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {loading && (
                <div className="px-4 py-8 text-center text-sm text-[var(--mutfg)]">Loading…</div>
              )}
              {!loading && pageRows.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-[var(--mutfg)]">
                  No documents match the filter.
                </div>
              )}

              {/* Pagination */}
              {!loading && filtered.length > 0 && (
                <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-sm">
                  <span className="text-xs text-[var(--mutfg)]">
                    Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} documents
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--mutfg)] hover:bg-[var(--muted)] disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`grid h-8 w-8 place-items-center rounded-md text-sm ${i === safePage ? 'bg-blue-600 text-white' : 'border border-[var(--border)] text-[var(--mutfg)] hover:bg-[var(--muted)]'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--mutfg)] hover:bg-[var(--muted)] disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Delete (single) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="mt-3 text-base font-bold text-[var(--fg)]">Delete Knowledge?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--mutfg)]">
              Knowledge <span className="font-semibold text-[var(--fg)]">{confirmDelete.name}</span> will be permanently deleted along with its vector index. This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={executeDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmBulkDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="mt-3 text-base font-bold text-[var(--fg)]">Delete {selected.size} Documents?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--mutfg)]">
              {selected.size} selected Knowledge items will be permanently deleted along with their vector indexes. This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={executeBulkDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              >
                Delete {selected.size} Documents
              </button>
              <button
                onClick={() => setConfirmBulkDelete(false)}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
