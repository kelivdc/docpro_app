import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspaceState } from '../lib/workspace-state'
import { listWorkspacesFn, createWorkspaceFn, renameWorkspaceFn, deleteWorkspaceFn, type WorkspaceView } from '../server/functions/workspace'

type ModalState =
  | { kind: 'create' }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'delete'; id: string; name: string; documentCount: number }
  | null

function Modal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  const [name, setName] = useState(state?.kind === 'rename' ? state.name : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state) setName(state.kind === 'rename' ? state.name : '')
    setError(null)
  }, [state])

  if (!state) return null

  const title = state.kind === 'create' ? 'Create New Workspace' : state.kind === 'rename' ? 'Rename Workspace' : 'Delete Workspace'
  const accent = state.kind === 'delete'
    ? 'bg-red-500/10 text-red-600'
    : 'bg-blue-500/10 text-blue-600'
  const icon = state.kind === 'delete' ? (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
  )

  async function submit() {
    setError(null)
    setBusy(true)
    const s = state
    if (!s) {
      setBusy(false)
      return
    }
    try {
      if (s.kind === 'create') {
        const res = await createWorkspaceFn({ data: { name: name.trim() } })
        window.dispatchEvent(new CustomEvent('docpro-workspace-created', { detail: res.id }))
        onClose()
      } else if (s.kind === 'rename') {
        await renameWorkspaceFn({ data: { id: s.id, name: name.trim() } })
        window.dispatchEvent(new CustomEvent('docpro-workspace-renamed'))
        onClose()
      } else {
        await deleteWorkspaceFn({ data: { id: s.id } })
        window.dispatchEvent(new CustomEvent('docpro-workspace-deleted', { detail: s.id }))
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`mb-1 grid h-10 w-10 place-items-center rounded-xl ${accent}`}>{icon}</div>
        <h3 className="mt-3 text-base font-bold text-[var(--fg)]">{title}</h3>

        {state.kind === 'delete' ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--mutfg)]">
            Workspace <span className="font-semibold text-[var(--fg)]">{state.name}</span>
            {state.documentCount > 0
              ? ` along with its ${state.documentCount} knowledge items and all chat sessions`
              : ' along with all its chat sessions'}{' '}
            will be permanently deleted. This action cannot be undone.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              maxLength={60}
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3.5 py-2.5 text-sm text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--mutfg)] focus:border-blue-500"
            />
          </form>
        )}

        {error && (
          <p className="mt-2.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
        )}

        <div className="mt-5 flex items-center gap-3">
          {state.kind !== 'delete' && (
            <button
              onClick={submit}
              disabled={busy || name.trim().length === 0}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : state.kind === 'create' ? 'Create' : 'Save'}
            </button>
          )}
          {state.kind === 'delete' && (
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete Workspace'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--muted)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function WorkspaceSwitcher() {
  const { workspaceId, setWorkspace } = useWorkspaceState()
  const [workspaces, setWorkspaces] = useState<WorkspaceView[]>([])
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!toast) return
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [toast])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function refresh() {
    setWorkspaces(await listWorkspacesFn())
  }

  useEffect(() => {
    let active = true
    listWorkspacesFn().then((list) => {
      if (!active) return
      setWorkspaces(list)
      if (!workspaceId && list.length > 0) setWorkspace(list[0].id)
      else if (workspaceId && !list.some((w) => w.id === workspaceId) && list.length > 0) {
        setWorkspace(list[0].id)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const onWorkspaceEvent = (e: Event) => {
    if (e.type === 'docpro-workspace-created') {
      const detail = (e as CustomEvent).detail as string | undefined
      if (detail) setWorkspace(detail)
    }
    refresh().catch(() => {})
  }

  useEffect(() => {
    window.addEventListener('docpro-workspace-created', onWorkspaceEvent)
    window.addEventListener('docpro-workspace-renamed', onWorkspaceEvent)
    window.addEventListener('docpro-workspace-deleted', onWorkspaceEvent)
    return () => {
      window.removeEventListener('docpro-workspace-created', onWorkspaceEvent)
      window.removeEventListener('docpro-workspace-renamed', onWorkspaceEvent)
      window.removeEventListener('docpro-workspace-deleted', onWorkspaceEvent)
    }
  }, [])

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-56 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-left text-sm text-[var(--fg)] hover:border-[var(--mutfg)]"
      >
        <span className="shrink-0">{activeWorkspace?.icon ?? '🏛'}</span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {activeWorkspace?.name ?? 'Workspace'}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--mutfg)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="absolute left-0 right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg">
            <div className="max-h-56 overflow-y-auto py-1">
              {workspaces.map((w) => (
                <div key={w.id} className="group/item flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)]">
                  <button
                    type="button"
                    onClick={() => {
                      if (w.id !== workspaceId) {
                        setWorkspace(w.id)
                        setToast(w.name)
                      }
                      setOpen(false)
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
                      w.id === workspaceId ? 'text-blue-600 font-semibold' : 'text-[var(--mutfg)]'
                    }`}
                  >
                    <span className="shrink-0">{w.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    <span className="text-xs text-[var(--mutfg)]">{w.documentCount}</span>
                  </button>
                  {!w.isDefault && (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => {
                          setModal({ kind: 'rename', id: w.id, name: w.name })
                          setOpen(false)
                        }}
                        className="rounded p-0.5 text-[var(--mutfg)] hover:text-blue-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => {
                          setModal({ kind: 'delete', id: w.id, name: w.name, documentCount: w.documentCount })
                          setOpen(false)
                        }}
                        className="rounded p-0.5 text-[var(--mutfg)] hover:text-red-500"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setModal({ kind: 'create' })
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-sm text-blue-600 hover:bg-[var(--muted)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Workspace
            </button>
          </div>
        </>
      )}

      <Modal state={modal} onClose={() => setModal(null)} />

      {toast && createPortal(
        <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-2xl">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
          <span className="text-sm font-medium text-[var(--fg)]">
            Switched to <span className="font-bold">{toast}</span>
          </span>
        </div>,
        document.body,
      )}
    </div>
  )
}
