import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import {
  listCategories,
  createCategory,
  deleteCategory,
  type CategoryView,
} from '../../server/functions/categories'

export const Route = createFileRoute('/dashboard/categories')({
  component: CategoriesPage,
  head: () => ({
    meta: [{ title: 'DocPro — Categories' }],
  }),
})

const ICONS = ['📄', '💳', '👥', '📊', '⚖️', '📁', '🏷️', '📦', '🗂️', '🔧']
const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

function CategoriesPage() {
  const [cats, setCats] = useState<CategoryView[]>([])
  const [uncategorized, setUncategorized] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')
  const [color, setColor] = useState('#2563EB')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const res = (await listCategories()) as { categories: CategoryView[]; uncategorized: number }
      setCats(res.categories)
      setUncategorized(res.uncategorized)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Category name is required')
      return
    }
    setBusy(true)
    try {
      await createCategory({ data: { name, description, icon, color } })
      setName('')
      setDescription('')
      setShowForm(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add category')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteCategory({ data: { id } })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const totalDocs = cats.reduce((s, c) => s + c.count, 0)

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 rounded-2xl bg-[var(--bg-soft)] px-6 py-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Category Management</h1>
            <p className="mt-1.5 text-sm text-[var(--mutfg)]">
              Organize categories to group documents so they are easier to find.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add category
          </button>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={submit} className="card-premium space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Category name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Contracts"
                className="demo-input w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agreements, MoUs, partnerships"
                className="demo-input w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${icon === ic ? 'ring-2 ring-blue-500' : 'bg-[var(--muted)]'}`}
                >
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-[var(--fg)]' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--fg)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="grid grid-cols-3 gap-3">
          <div className="card-premium p-4">
            <div className="text-xs text-[var(--mutfg)]">Total categories</div>
            <div className="mt-1 text-xl font-extrabold text-[var(--fg)]">{cats.length}</div>
          </div>
          <div className="card-premium p-4">
            <div className="text-xs text-[var(--mutfg)]">Categorized Knowledge</div>
            <div className="mt-1 text-xl font-extrabold text-[var(--fg)]">{totalDocs}</div>
          </div>
          <div className="card-premium p-4">
            <div className="text-xs text-[var(--mutfg)]">Uncategorized</div>
            <div className="mt-1 text-xl font-extrabold text-amber-600">{uncategorized}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="card-premium p-6 text-sm text-[var(--mutfg)]">Loading…</div>
          ) : cats.length === 0 ? (
            <div className="card-premium p-6 text-sm text-[var(--mutfg)]">
              No categories yet. Click "Add category" to create one.
            </div>
          ) : (
            cats.map((c) => (
              <div key={c.id} className="card-premium flex flex-col p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl text-xl"
                    style={{ background: `${c.color}1a`, color: c.color }}
                  >
                    {c.icon}
                  </div>
                  <button
                    onClick={() => remove(c.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--mutfg)] hover:bg-[var(--muted)]"
                    aria-label="Delete"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  </button>
                </div>
                <div className="text-sm font-semibold text-[var(--fg)]">{c.name}</div>
                <div className="mt-0.5 text-xs text-[var(--mutfg)]">{c.description || '—'}</div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-xs text-[var(--mutfg)]">{c.count} documents</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                </div>
              </div>
            ))
          )}

          <div className="card-premium flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] p-4 text-center hover:border-blue-500 hover:bg-blue-500/10">
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-[var(--muted)] text-xl text-[var(--mutfg)]">+</div>
            <div className="text-sm font-medium text-[var(--mutfg)]">Add new category</div>
            <div className="mt-0.5 text-xs text-[var(--mutfg)]">Create custom grouping</div>
          </div>
        </section>
      </main>
    </>
  )
}
