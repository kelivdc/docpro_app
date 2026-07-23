import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, useRouter, useNavigate, useSearch } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import { uploadDocument, updateDocument, getDocument, getDocumentContent } from '../../server/functions/upload'
import { listCategories, createCategory } from '../../server/functions/categories'

export const Route = createFileRoute('/dashboard/files')({
  component: FilesPage,
  head: () => ({
    meta: [{ title: 'DocPro — Upload Knowledge' }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === 'string' ? search.edit : undefined,
  }),
})

const ACCEPTED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
]
const ACCEPTED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif', '.bmp']
const MAX_SIZE = 150 * 1024 * 1024

const SHARE_OPTIONS = [
  { value: 'private', label: 'Private — only me' },
  { value: 'public', label: 'Public — all users' },
]

const SOURCE_TYPES = [
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'website', label: 'Website', icon: '🌐' },
  { value: 'manual', label: 'Manual Entry', icon: '📝' },
  { value: 'api', label: 'API', icon: '🔌' },
]

const PROGRESS_STEPS = [
  { phase: 'Uploading…', pct: 35, substeps: [] as string[] },
  { phase: 'Processing Knowledge…', pct: 70, substeps: ['Extracting text', 'Chunking', 'Generating embeddings'] },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function hasAcceptedExt(name: string) {
  const lower = name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext))
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function FilesPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [category, setCategory] = useState('')
  const [sourceType, setSourceType] = useState('document')
  const [note, setNote] = useState('')
  const [share, setShare] = useState('private')
  const [hidden, setHidden] = useState(false)
  const [path, setPath] = useState('')
  const [expiredAt, setExpiredAt] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [submitError, setSubmitError] = useState('')
  const [progress, setProgress] = useState(0)
  const [doneSubsteps, setDoneSubsteps] = useState<string[]>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [categories, setCategories] = useState<{ name: string }[]>([])
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  // Source-type-specific fields
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiMethod, setApiMethod] = useState('POST')
  const [apiKey, setApiKey] = useState('')
  const [apiHeaders, setApiHeaders] = useState('')
  const [apiBody, setApiBody] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  const { edit } = useSearch({ from: Route.id })

  useEffect(() => {
    if (!edit) return
    ;(async () => {
      try {
        const doc: any = await getDocument({ data: { id: edit } })
        setEditId(edit)
        setName(doc.name || '')
        setSourceType(doc.sourceType || 'document')
        setCategory(doc.category || '')
        setNote(doc.note || '')
        setPath(doc.path || '')
        setShare(doc.share || 'private')
        setHidden(!!doc.hidden)
        if (doc.expiredAt) setExpiredAt(new Date(doc.expiredAt).toISOString().split('T')[0])
        const { content } = await getDocumentContent({ data: { id: edit } })
        if (content) {
          if (doc.sourceType === 'manual') setManualContent(content)
          else if (doc.sourceType === 'website') {
            const match = content.match(/^URL: (.+)/m)
            if (match) setUrl(match[1])
          } else if (doc.sourceType === 'api') {
            const ep = content.match(/^Endpoint: (.+)/m)
            const meth = content.match(/^Method: (.+)/m)
            const key = content.match(/^Auth: (.+)/m)
            if (ep) setApiEndpoint(ep[1])
            if (meth) setApiMethod(meth[1] as 'GET' | 'POST')
            if (key) setApiKey(key[1] === 'none' ? '' : key[1])
          }
        }
      } catch { /* ignore */ }
    })()
  }, [edit])

  const loadCategories = useCallback(async () => {
    try {
      const res = await listCategories()
      setCategories(res.categories as { name: string }[])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const createNewCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await createCategory({ data: { name } })
      setNewCatName('')
      setShowNewCat(false)
      await loadCategories()
      setCategory(name)
    } catch { /* ignore */ }
  }

  const setSourceTypeAndReset = (st: string) => {
    setSourceType(st)
    setErrors((p) => ({ ...p, file: '', content: '', url: '', apiEndpoint: '' }))
  }

  const selectFile = (f: File | null) => {
    if (!f) return
    const next: Record<string, string> = { ...errors }
    if (!ACCEPTED.includes(f.type) && !hasAcceptedExt(f.name)) {
      next.file = 'Only PDF/Word/Excel/Text/Image formats (.pdf, .doc, .docx, .xls, .xlsx, .txt, .png, .jpg, .gif, .webp, .tiff)'
    } else if (f.size > MAX_SIZE) {
      next.file = 'Maximum size 150 MB'
    } else {
      delete next.file
    }
    setErrors(next)
    setFile(f)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (sourceType === 'document') {
      if (!file) next.file = 'Select a file first'
    } else if (sourceType === 'website') {
      if (!url.trim()) next.url = 'Enter a website URL'
    } else if (sourceType === 'manual') {
      if (!manualContent.trim()) next.content = 'Enter content'
    } else if (sourceType === 'api') {
      if (!apiEndpoint.trim()) next.apiEndpoint = 'Enter API endpoint URL'
    }
    if (!category) next.category = 'Select a category'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const clearProgress = useCallback(() => {
    setProgress(0)
    setDoneSubsteps([])
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setStatus('uploading')
    setSubmitError('')
    setProgress(0)
    setDoneSubsteps([])

    let docName = name || file?.name || ''
    let payload: Record<string, any> = {
      category: category || null,
      sourceType,
      note,
      path,
      share,
      hidden,
      expired: expiredAt ? true : false,
      expiredAt: expiredAt || null,
    }

    if (sourceType === 'document') {
      if (!file) return
      docName = file.name
    } else if (sourceType === 'website') {
      docName = docName || new URL(url).hostname
      payload.content = `URL: ${url}\n\nPage content will be fetched during processing.`
    } else if (sourceType === 'manual') {
      docName = docName || 'Manual Entry'
      payload.content = manualContent
    } else if (sourceType === 'api') {
      docName = docName || apiEndpoint
      payload.content = `Endpoint: ${apiEndpoint}\nMethod: ${apiMethod}\nAuth: ${apiKey || 'none'}\nHeaders: ${apiHeaders || 'none'}\nBody: ${apiBody || 'none'}\n\nDocumentation will be fetched during processing.`
    }

    // Phase 1: uploading
    const uploadTimer = setInterval(() => {
      setProgress((p) => {
        if (p < 35) return p + 1
        clearInterval(uploadTimer)
        return p
      })
    }, 80)

    try {
      if (sourceType === 'document' && file) {
        const buf = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(buf)
        payload.name = file.name
        payload.mime = file.type || 'application/octet-stream'
        payload.size = file.size
        payload.base64 = base64
      } else {
        payload.name = docName
      }

      await new Promise((r) => setTimeout(r, 400))
      clearInterval(uploadTimer)
      setProgress(35)
      setStatus('processing')

      // Phase 2: processing (substeps)
      const stepTimer = setInterval(() => {
        setProgress((p) => {
          if (p < 70) return p + 0.5
          clearInterval(stepTimer)
          return p
        })
      }, 120)

      // Simulate substeps with delays
      const substeps = ['Extracting text', 'Chunking', 'Generating embeddings']
      for (const s of substeps) {
        await new Promise((r) => setTimeout(r, 800))
        setDoneSubsteps((prev) => [...prev, s])
      }

      clearInterval(stepTimer)
      setProgress(70)

      // Actual upload
      let result
      if (editId) {
        const upd: Record<string, any> = {
          id: editId,
          name: docName,
          category: category || null,
          sourceType,
        }
        if (sourceType === 'document' && file) {
          const buf = await file.arrayBuffer()
          upd.base64 = arrayBufferToBase64(buf)
          upd.mime = file.type || 'application/octet-stream'
          upd.size = file.size
        } else if (payload.content) {
          const enc = new TextEncoder()
          const bytes = enc.encode(payload.content)
          upd.base64 = btoa(String.fromCharCode(...bytes))
          upd.mime = 'text/plain'
          upd.size = bytes.length
        }
        result = await updateDocument({ data: upd })
      } else {
        result = await uploadDocument({ data: payload })
      }

      if (result.status === 'error') {
        setSubmitError(result.error || 'Failed to process document')
        setStatus('error')
        clearProgress()
      } else {
        setProgress(100)
        setDocumentId(result.documentId)
        await new Promise((r) => setTimeout(r, 400))
        await router.invalidate()
        setStatus('done')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
      clearProgress()
    }
  }

  const resetForm = () => {
    setFile(null)
    setName('')
    setUrl('')
    setManualContent('')
    setApiEndpoint('')
    setApiMethod('POST')
    setApiKey('')
    setApiHeaders('')
    setApiBody('')
    setNote('')
    setPath('')
    setCategory('')
    setSourceType('document')
    setExpiredAt('')
    setHidden(false)
    setShare('private')
    setAdvancedOpen(false)
    setErrors({})
    setStatus('idle')
    setDocumentId(null)
    clearProgress()
  }

  return (
    <>
      <DashboardHeader />
      <main className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1100px] rounded-2xl bg-[var(--bg-soft)] px-4 py-10 md:px-6 md:py-14">
        {status === 'done' ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-6 rounded-2xl border border-emerald-500/20 bg-[var(--card-bg)] p-10 text-center shadow-sm">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--fg)]">{editId ? 'Knowledge Updated' : 'Knowledge Ready'}</h2>
              <p className="mt-1.5 text-sm text-[var(--mutfg)]">Your document is now searchable by AI.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  navigate({ to: '/dashboard/chat' })
                }}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25"
              >
                Ask AI
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: '/dashboard/documents' })}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--muted)]"
              >
                View Knowledge Sources
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--muted)]"
              >
                Upload Another
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--fg)]">{editId ? 'Edit Knowledge' : 'Upload Knowledge'}</h1>
              <p className="mt-2 text-sm text-[var(--mutfg)]">
                {editId ? 'Update your Knowledge Source.' : 'Add a new Knowledge Source to make it searchable by AI.'}
              </p>
            </div>

            <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-[900px] grid-cols-1 gap-8 lg:grid-cols-5">
              {/* Left column */}
              <div className="space-y-6 lg:col-span-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm md:p-7">
                  {/* Content Area — adapts to Source Type */}
                  <div>
                    {sourceType === 'document' ? (
                      <>
                        {file ? (
                          <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 p-6">
                            <div className="flex items-center gap-4">
                              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/10">
                                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-[var(--fg)]">{file.name}</div>
                                <div className="text-xs text-[var(--mutfg)]">{formatSize(file.size)}</div>
                              </div>
                              <div className="shrink-0 text-xs font-medium text-emerald-600">Ready to upload</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFile(null)}
                              className="mt-3 text-xs font-medium text-[var(--mutfg)] underline underline-offset-2 hover:text-[var(--fg)]"
                            >
                              Replace file
                            </button>
                          </div>
                        ) : (
                          <label
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); selectFile(e.dataTransfer.files?.[0] ?? null) }}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('file-input')?.click() }
                            }}
                            className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-14 text-center outline-none transition-all ${
                              dragOver ? 'border-blue-500 bg-blue-500/10' : errors.file ? 'border-red-500' : 'border-[var(--border)] hover:border-blue-500/50 focus:border-blue-500'
                            }`}
                          >
                            <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--muted)]">
                              <svg className="h-7 w-7 text-[var(--mutfg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                            </div>
                            <div>
                              <div className="text-base font-semibold text-[var(--fg)]">Upload your Knowledge</div>
                              <div className="mt-1 text-sm text-[var(--mutfg)]">Drag & Drop or click to browse</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--mutfg)]">
                              <span>PDF</span><span className="text-[var(--border)]">•</span>
                              <span>Word</span><span className="text-[var(--border)]">•</span>
                              <span>Excel</span><span className="text-[var(--border)]">•</span>
                              <span>Text</span><span className="text-[var(--border)]">•</span>
                              <span>Image</span>
                            </div>
                            <div className="text-xs text-[var(--mutfg)]">Maximum file size: 150 MB</div>
                            <input id="file-input" type="file" accept={ACCEPTED_EXT.join(',')} className="hidden" onChange={(e) => selectFile(e.target.files?.[0] ?? null)} />
                          </label>
                        )}
                        {errors.file && <p className="mt-2 text-xs text-red-600">{errors.file}</p>}
                      </>
                    ) : sourceType === 'website' ? (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                          Website URL <span className="text-red-600">*</span>
                        </label>
                        <input
                          value={url}
                          onChange={(e) => { setUrl(e.target.value); if (e.target.value) setErrors((p) => ({ ...p, url: '' })) }}
                          placeholder="https://example.com/documentation"
                          className={`demo-input w-full ${errors.url ? 'border-red-500' : ''}`}
                        />
                        {errors.url && <p className="mt-2 text-xs text-red-600">{errors.url}</p>}
                        <p className="mt-1.5 text-xs text-[var(--mutfg)]">
                          Enter the URL of the website you want to make searchable by AI.
                        </p>
                      </div>
                    ) : sourceType === 'manual' ? (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                          Content <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={manualContent}
                          onChange={(e) => { setManualContent(e.target.value); if (e.target.value) setErrors((p) => ({ ...p, content: '' })) }}
                          rows={10}
                          placeholder="Paste or type your knowledge content here…"
                          className={`demo-input w-full resize-y ${errors.content ? 'border-red-500' : ''}`}
                        />
                        {errors.content && <p className="mt-2 text-xs text-red-600">{errors.content}</p>}
                      </div>
                    ) : sourceType === 'api' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                            API Endpoint URL <span className="text-red-600">*</span>
                          </label>
                          <input
                            value={apiEndpoint}
                            onChange={(e) => { setApiEndpoint(e.target.value); if (e.target.value) setErrors((p) => ({ ...p, apiEndpoint: '' })) }}
                            placeholder="https://api.example.com/v1/knowledge"
                            className={`demo-input w-full ${errors.apiEndpoint ? 'border-red-500' : ''}`}
                          />
                          {errors.apiEndpoint && <p className="mt-2 text-xs text-red-600">{errors.apiEndpoint}</p>}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Method</label>
                          <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-0.5">
                            {['GET', 'POST'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setApiMethod(m)}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                                  apiMethod === m ? 'bg-[var(--card-bg)] text-blue-600 shadow-sm' : 'text-[var(--mutfg)] hover:text-[var(--fg)]'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">API Key</label>
                          <input
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Optional API key for authentication"
                            className="demo-input w-full"
                            type="password"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                            Headers <span className="text-[var(--mutfg)]">(JSON)</span>
                          </label>
                          <textarea
                            value={apiHeaders}
                            onChange={(e) => setApiHeaders(e.target.value)}
                            rows={4}
                            placeholder='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'
                            className="demo-input w-full resize-y font-mono text-xs"
                          />
                          <p className="mt-1 text-xs text-[var(--mutfg)]">
                            Optional HTTP headers sent with the request.
                          </p>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                            Request Body <span className="text-[var(--mutfg)]">(JSON)</span>
                          </label>
                          <textarea
                            value={apiBody}
                            onChange={(e) => setApiBody(e.target.value)}
                            rows={6}
                            placeholder='{"query": "Get me the latest financial reports"}'
                            className="demo-input w-full resize-y font-mono text-xs"
                          />
                          <p className="mt-1 text-xs text-[var(--mutfg)]">
                            Optional JSON payload sent as the request body.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Name field — shown for non-document types */}
                    {sourceType !== 'document' && (
                      <div className="mt-5">
                        <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                          Name <span className="text-[var(--mutfg)]">(optional)</span>
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={sourceType === 'website' ? 'My Website' : sourceType === 'manual' ? 'My Notes' : 'API Source'}
                          className="demo-input w-full"
                        />
                        <p className="mt-1 text-xs text-[var(--mutfg)]">Auto-generated from your input if left blank.</p>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="mt-6">
                    <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">
                      Category <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setShowNewCat(true)
                            setCategory('')
                            return
                          }
                          setCategory(e.target.value)
                          if (e.target.value) setErrors((p) => ({ ...p, category: '' }))
                        }}
                        className={`demo-input w-full ${errors.category ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select category…</option>
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                        <option value="__new__">+ Create Category</option>
                      </select>
                    </div>
                    {errors.category && <p className="mt-1.5 text-xs text-red-600">{errors.category}</p>}

                    {showNewCat && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); createNewCategory() }
                            if (e.key === 'Escape') { setShowNewCat(false); setNewCatName('') }
                          }}
                          placeholder="New category name"
                          className="demo-input flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={createNewCategory}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewCat(false); setNewCatName('') }}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--mutfg)]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Source Type */}
                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-[var(--fg)]">Source Type</label>
                    <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--muted)] p-1">
                      {SOURCE_TYPES.map((st) => (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => setSourceTypeAndReset(st.value)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-all ${
                            sourceType === st.value
                              ? 'bg-[var(--card-bg)] text-blue-600 shadow-sm'
                              : 'text-[var(--mutfg)] hover:text-[var(--fg)]'
                          }`}
                        >
                          <span className="text-sm">{st.icon}</span>
                          <span>{st.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div className="mt-6">
                    <label className="mb-1.5 block text-sm font-medium text-[var(--fg)]">Note</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Optional context to help AI better understand this Knowledge…"
                      className="demo-input w-full resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm md:p-7">
                  {/* Share */}
                  <div>
                    <label className="mb-3 block text-sm font-medium text-[var(--fg)]">Share</label>
                    <div className="space-y-2.5">
                      {SHARE_OPTIONS.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-center gap-3 text-sm text-[var(--fg)]">
                          <input
                            type="radio"
                            name="share"
                            value={o.value}
                            checked={share === o.value}
                            onChange={() => setShare(o.value)}
                            className="h-4 w-4"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div className="mt-6 border-t border-[var(--border)] pt-5">
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen((v) => !v)}
                      className="flex w-full items-center justify-between text-sm font-medium text-[var(--fg)]"
                    >
                      <span>Advanced Settings</span>
                      <svg
                        className={`h-4 w-4 text-[var(--mutfg)] transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {advancedOpen && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--fg)]">Expiration Date</label>
                          <input
                            type="date"
                            value={expiredAt}
                            onChange={(e) => setExpiredAt(e.target.value)}
                            className="demo-input w-full"
                          />
                          <p className="mt-1 text-xs text-[var(--mutfg)]">Knowledge hidden after this date.</p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--fg)]">Manual Path</label>
                          <input
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            placeholder="/archive/finance/2026"
                            className="demo-input w-full"
                          />
                          <p className="mt-1 text-xs text-[var(--mutfg)]">Source reference location.</p>
                        </div>

                        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-[var(--fg)]">
                          <span>Hidden from search</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={hidden}
                            onClick={() => setHidden((v) => !v)}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${hidden ? 'bg-blue-600' : 'bg-[var(--muted)]'}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${hidden ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {status === 'error' && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                    {submitError || 'Upload failed. Try again.'}
                  </div>
                )}

                <div className="lg:sticky lg:top-24">
                  <button
                    type="submit"
                    disabled={status === 'uploading' || status === 'processing'}
                    className="w-full justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-60"
                  >
                    {status === 'uploading' || status === 'processing' ? (editId ? 'Saving…' : 'Uploading…') : (editId ? 'Save Changes' : 'Upload Knowledge')}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      onClick={() => navigate({ to: '/dashboard/documents', replace: true })}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--muted)]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </>
        )}
      </main>

      {/* Upload Progress Modal */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              {status === 'uploading' ? (
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10">
                  <svg className="h-5 w-5 animate-pulse text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10">
                  <svg className="h-5 w-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-[var(--fg)]">{file?.name || name || (sourceType === 'website' ? url : sourceType === 'api' ? apiEndpoint : 'Knowledge')}</div>
                <div className="text-xs text-[var(--mutfg)]">{status === 'uploading' ? 'Uploading…' : 'Processing Knowledge…'}</div>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 70)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[11px] font-semibold text-[var(--mutfg)]">{Math.round(Math.min(progress, 70))}%</div>

            {status === 'processing' && (
              <div className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-4">
                {['Extracting text', 'Chunking', 'Generating embeddings'].map((step) => {
                  const done = doneSubsteps.includes(step)
                  return (
                    <div key={step} className="flex items-center gap-2 text-xs">
                      <span className={`${done ? 'text-emerald-600' : 'text-[var(--mutfg)]'}`}>
                        {done ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                          <svg className="h-3.5 w-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /></svg>
                        )}
                      </span>
                      <span className={done ? 'text-[var(--fg)]' : 'text-[var(--mutfg)]'}>{step}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
