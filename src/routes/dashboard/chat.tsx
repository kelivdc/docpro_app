import { useState, useRef, useEffect, useCallback } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DashboardHeader } from './index'
import { chatAsk, chatContinue, type ChatResponse } from '../../server/functions/chat'
import {
  listSessions,
  createSession,
  renameSession,
  deleteSession,
  getSession,
  getSessionMessages,
  saveSessionMessages,
  getLastSession,
  type SessionRow,
  type MessageRow,
} from '../../server/functions/sessions'
import { listDocuments } from '../../server/functions/upload'

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatPage,
  head: () => ({
    meta: [{ title: 'DocPro — AI Chat' }],
  }),
})

interface Msg {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatResponse['sources']
  limitHit?: boolean
  pending?: boolean
  audio?: string
  continueText?: string
  cost?: ChatResponse['cost']
  raw?: string
}

// True when the assistant reports it could not find an answer in the documents,
// so we hide the (irrelevant) sources block.
const isNoAnswer = (text: string) =>
  /could not find|cannot find|couldn't find|no (relevant|matching)|sorry, i couldn't/i.test(text)

function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Shell-style question history for UP/DOWN recall.
  const [history, setHistory] = useState<string[]>([])
  const historyIdx = useRef<number>(-1) // -1 = current (unsent) input
  const draftRef = useRef('') // in-progress text while browsing history
  // Tracks the currently-playing <audio> so we can stop it when voice is off.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // When true, the speak loop aborts and any playing audio is paused.
  const cancelSpeakRef = useRef(false)

  // Document source selection
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [docPickerOpen, setDocPickerOpen] = useState(false)

  // Session state
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const [msgs, session] = await Promise.all([
        getSessionMessages({ data: { id: sessionId } }) as Promise<MessageRow[]>,
        getSession({ data: { id: sessionId } }),
      ])
      setMessages(msgs.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources as ChatResponse['sources'] | undefined,
        cost: m.cost ?? undefined,
      })))
      setSelectedDocIds(session.documentIds ?? [])
      setHistory(msgs.filter((m) => m.role === 'user').map((m) => m.content))
    } catch {
      // ignore
    }
  }, [])

  const saveMessages = useCallback(async (sessionId: string, msgs: Msg[], docIds?: string[]) => {
    try {
      await saveSessionMessages({
        data: {
          sessionId,
          messages: msgs.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
            cost: m.cost,
          })),
          documentIds: docIds,
        },
      })
      // Refresh title locally instead of re-fetching (which would re-sort by updatedAt)
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s
          const firstUser = msgs.find((m) => m.role === 'user')
          if (firstUser && (s.title === 'New Chat' || !s.title)) {
            const autoTitle = firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '…' : '')
            return { ...s, title: autoTitle, documentIds: docIds ?? s.documentIds }
          }
          return { ...s, documentIds: docIds ?? s.documentIds }
        }),
      )
    } catch {
      // ignore
    }
  }, [])

  // Initialize: load sessions, last session, and documents
  useEffect(() => {
    ;(async () => {
      const [all, docs] = await Promise.all([listSessions(), listDocuments()])
      setSessions(all)
      setDocuments(docs.map((d) => ({ id: d.id, name: d.name })))
      if (all.length > 0) {
        const last = await getLastSession()
        if (last) {
          setCurrentSessionId(last.id)
          await loadSessionMessages(last.id)
        }
      }
      setLoaded(true)
    })()
  }, [])

  // Save messages and selectedDocIds to DB whenever they change (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentSessionId || !loaded) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveMessages(currentSessionId, messages, selectedDocIds)
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [messages, currentSessionId, loaded, selectedDocIds])

  const switchSession = useCallback(async (sessionId: string) => {
    // Save current session first
    if (currentSessionId) {
      await saveMessages(currentSessionId, messages, selectedDocIds)
    }
    setCurrentSessionId(sessionId)
    await loadSessionMessages(sessionId)
  }, [currentSessionId, messages, saveMessages, loadSessionMessages, selectedDocIds])

  const newSession = useCallback(async () => {
    // Save current session first
    if (currentSessionId) {
      await saveMessages(currentSessionId, messages, selectedDocIds)
    }
    const session = await createSession({ data: {} })
    setSessions((prev) => [session, ...prev])
    setCurrentSessionId(session.id)
    setMessages([])
    setHistory([])
    setSelectedDocIds([])
  }, [currentSessionId, messages, saveMessages, selectedDocIds])

  const doDeleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDeleteId(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)
    // Save documentIds before deleting
    if (currentSessionId === id) {
      await saveMessages(id, messages, selectedDocIds).catch(() => {})
    }
    await deleteSession({ data: { id } })
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (currentSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id)
      if (remaining.length > 0) {
        const next = remaining[0]
        setCurrentSessionId(next.id)
        await loadSessionMessages(next.id)
      } else {
        setCurrentSessionId(null)
        setMessages([])
        setHistory([])
        setSelectedDocIds([])
      }
    }
  }, [pendingDeleteId, currentSessionId, sessions, loadSessionMessages, saveMessages, messages, selectedDocIds])

  const cancelDelete = useCallback(() => setPendingDeleteId(null), [])

  const doRenameSession = useCallback(async (id: string) => {
    const title = editingTitle.trim()
    if (!title) {
      setEditingSessionId(null)
      return
    }
    await renameSession({ data: { id, title } })
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)))
    setEditingSessionId(null)
  }, [editingTitle])

  const startEditing = useCallback((id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(id)
    setEditingTitle(currentTitle)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener('voiceschanged', warm)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', warm)
  }, [])

  // Mark this message as "speaking" (for UI state only).
  const markSpeaking = (msgIndex: number, kind: string) =>
    setMessages((m) => {
      const next = [...m]
      if (next[msgIndex]) next[msgIndex] = { ...next[msgIndex], audio: kind }
      return next
    })

  // Strip punctuation that TTS engines read aloud ("quote", parens, etc).
  const cleanPunctuation = (text: string): string =>
    text.replace(/["'`‘’"“”()\[\]{}*_~#]/g, '').replace(/\s+/g, ' ').trim()

  // Split into chunks small enough for the TTS engine (Google caps ~200 chars).
  const chunkText = (text: string, max = 180): string[] => {
    const clean = cleanPunctuation(text)
    if (clean.length <= max) return [clean]
    const chunks: string[] = []
    // Break on sentence boundaries first, then hard-split long runs.
    const parts = clean.match(/[^.!?]+[.!?]*/g) ?? [clean]
    let buf = ''
    for (const p of parts) {
      if ((buf + p).length > max) {
        if (buf) chunks.push(buf.trim())
        buf = ''
        if (p.length > max) {
          for (let i = 0; i < p.length; i += max) chunks.push(p.slice(i, i + max).trim())
        } else {
          buf = p
        }
      } else {
        buf += p
      }
    }
    if (buf.trim()) chunks.push(buf.trim())
    return chunks.filter(Boolean)
  }

  // Play one chunk from the server TTS endpoint, resolving when finished.
  // Honors cancelSpeakRef so toggling voice off mid-read stops playback.
  const playChunk = (chunk: string) =>
    new Promise<void>((resolve) => {
      if (cancelSpeakRef.current) return resolve()
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(chunk)}&rate=150`)
      audioRef.current = audio
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })

  // For long answers (>400 chars), split into a first part and the rest so the
  // AI reads the first part, then asks "Would you like to continue?" before reading more.
  const splitLongAnswer = (text: string, firstMax = 300) => {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean.length <= 400) return null
    const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean]
    let first = ''
    for (const s of sentences) {
      if ((first + s).length > firstMax) break
      first += s
    }
    const firstTrim = first.trim()
    const rest = clean.slice(firstTrim.length).trim()
    if (!rest) return null
    return { first: firstTrim, rest }
  }

  // Prefer the server-generated audio (Google TTS — natural voice, works on
  // ALL browsers). Text is spoken in small chunks because the TTS engine has a
  // per-request length cap. Browser speechSynthesis is only a secondary
  // fallback if the server audio cannot play (e.g. fully offline).
  const speak = async (text: string, msgIndex: number) => {
    cancelSpeakRef.current = false
    const cleaned = cleanPunctuation(text)
    markSpeaking(msgIndex, 'server')
    const chunks = chunkText(cleaned)
    try {
      for (const c of chunks) {
        if (cancelSpeakRef.current) break
        await playChunk(c)
      }
      audioRef.current = null
      return
    } catch {
      // fall through to browser speech
    }
    if (cancelSpeakRef.current) return
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const synth = window.speechSynthesis
      if (synth.speaking) synth.cancel()
      const u = new SpeechSynthesisUtterance(cleaned)
      const voices = synth.getVoices()
      const enVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('en'))
      if (enVoice) u.voice = enVoice
      u.lang = enVoice?.lang ?? 'en-US'
      u.rate = 0.95
      u.onerror = () =>
        setError('Failed to play audio. Make sure your browser allows audio playback.')
      synth.speak(u)
      return
    }
    setError('Failed to play audio. Make sure your browser allows audio playback.')
  }

  // Speak the remaining part of a long answer after the user confirms.
  const continueReading = async (text: string, msgIndex: number) => {
    if (!voiceOn) return
    await speak(text, msgIndex)
  }

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setError('')
    setInput('')

    // Auto-create session if none active
    let sid = currentSessionId
    if (!sid) {
      const autoTitle = q.slice(0, 60) + (q.length > 60 ? '…' : '')
      const session = await createSession({ data: { title: autoTitle } })
      sid = session.id
      setCurrentSessionId(sid)
      setSessions((prev) => [session, ...prev])
    }

    // Record the question so it can be recalled later with UP/DOWN.
    setHistory((h) => [...h, q])
    historyIdx.current = -1
    setBusy(true)
    // Unlock speechSynthesis within the user gesture so the auto-speak
    // (after the async chat round-trip) is allowed to play.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    const userMsg: Msg = { role: 'user', content: q }
    const assistantMsg: Msg = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, userMsg, assistantMsg])
    const myIndex = messages.length + 1
    // History = turns that came BEFORE this new user question (for standalone rewrite).
    const history = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await chatAsk({ data: { question: q, history, documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined } }) as ChatResponse
      let finalCost = res.cost
      const finalRaw = res.raw

      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = {
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          limitHit: res.limitHit,
          cost: res.cost,
          raw: res.raw,
        }
        return next
      })

      // Auto-continue if the model hit its output token limit (answer truncated).
      // Fetch the rest in a loop without repeating, appending to the same message.
      let fullAnswer = res.answer
      let finalSources = res.sources
      let truncated = res.truncated
      while (truncated) {
        setMessages((m) => {
          const n = [...m]
          n[myIndex] = {
            ...n[myIndex],
            content: fullAnswer + '\n\n_Answer continues..._',
          }
          return n
        })
        const cont = await chatContinue({
          data: { question: q, priorAnswer: fullAnswer, history, documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined },
        }) as ChatResponse
        if (cont.limitHit) {
          fullAnswer += (fullAnswer.endsWith('\n') ? '' : '\n') + cont.answer
          truncated = false
          break
        }
        fullAnswer += (fullAnswer.endsWith('\n') ? '' : '\n') + cont.answer
        finalSources = cont.sources
        truncated = cont.truncated
      }
      if (res.truncated) {
        setMessages((m) => {
          const n = [...m]
          n[myIndex] = {
            ...n[myIndex],
            content: fullAnswer,
            sources: finalSources,
            cost: finalCost,
            raw: finalRaw,
          }
          return n
        })
      }

      if (voiceOn && !res.limitHit) {
        const split = splitLongAnswer(fullAnswer)
        if (split) {
          // Read the first part, then ask the user if they want more.
          await speak(split.first + '.', myIndex)
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              content: 'Would you like to continue?',
              continueText: split.rest,
            } as Msg,
          ])
        } else {
          await speak(fullAnswer, myIndex)
        }
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m]
        next[next.length - 1] = {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'An error occurred.',
        }
        return next
      })
    } finally {
      await router.invalidate().catch(() => {})
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <DashboardHeader />
      <div className="flex min-h-0 flex-1">
        {/* Session sidebar */}
        <div
          className={`flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card-bg)] transition-all ${
            sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] p-3">
            <button
              onClick={newSession}
              className="flex-1 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--mutfg)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              + New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => switchSession(s.id)}
                className={`group mb-1 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  currentSessionId === s.id
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'text-[var(--fg)] hover:bg-[var(--muted)]'
                }`}
              >
                {editingSessionId === s.id ? (
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => doRenameSession(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doRenameSession(s.id)
                      if (e.key === 'Escape') setEditingSessionId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 rounded bg-[var(--card-bg)] px-1 py-0.5 text-sm outline-none ring-1 ring-blue-500"
                  />
                ) : (
                  <span
                    className="flex-1 truncate"
                    onDoubleClick={(e) => startEditing(s.id, s.title, e)}
                    title={s.title}
                  >
                    {s.title}
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => startEditing(s.id, s.title, e)}
                    className="rounded p-0.5 hover:bg-[var(--muted)]"
                    title="Rename"
                  >
                    <svg className="h-3.5 w-3.5 text-[var(--mutfg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => doDeleteSession(s.id, e)}
                    className="rounded p-0.5 hover:bg-red-500/20"
                    title="Delete chat"
                  >
                    <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex shrink-0 items-center border-r border-[var(--border)] px-1.5 text-[var(--mutfg)] hover:bg-[var(--muted)]"
          title={sidebarOpen ? 'Close history' : 'Open history'}
        >
          <svg className={`h-4 w-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Main chat area */}
        <main className="flex min-w-0 flex-1 flex-col rounded-2xl bg-[var(--bg-soft)] px-6 pt-3 pb-4">
          <div className="mb-3 shrink-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">AI Chat</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--mutfg)]">
              Answers are based only on your uploaded documents. Verify source Knowledge for
              important decisions.
            </p>
          </div>

          {/* Source selector */}
          <div className="relative mb-3 shrink-0">
            <button
              onClick={() => setDocPickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--muted)]"
            >
              <span className="text-xs">📚</span>
              {selectedDocIds.length === 0
                ? 'All Knowledge sources'
                : `${selectedDocIds.length} source${selectedDocIds.length > 1 ? 's' : ''} selected`}
              <svg className={`h-3 w-3 text-[var(--mutfg)] transition-transform ${docPickerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {docPickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDocPickerOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-2 shadow-xl">
                  {documents.length === 0 && (
                    <p className="px-2 py-3 text-xs text-[var(--mutfg)]">No documents uploaded yet.</p>
                  )}
                  {documents.map((doc) => {
                    const checked = selectedDocIds.includes(doc.id)
                    return (
                      <label
                        key={doc.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--muted)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedDocIds((prev) =>
                              checked ? prev.filter((id) => id !== doc.id) : [...prev, doc.id],
                            )
                          }}
                          className="h-3.5 w-3.5 rounded border-[var(--border)] text-blue-600"
                        />
                        <span className="truncate">{doc.name}</span>
                      </label>
                    )
                  })}
                  {documents.length > 0 && selectedDocIds.length > 0 && (
                    <button
                      onClick={() => setSelectedDocIds([])}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs text-[var(--mutfg)] hover:bg-[var(--muted)]"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-[var(--border)] p-4"
            style={{
              backgroundImage: 'url("/chat-balasan.png")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {messages.length === 0 && (
              <div className="flex justify-center py-16">
                <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]/90 p-6 text-center text-sm text-[var(--mutfg)] shadow-sm backdrop-blur">
                  <div className="text-lg font-bold text-[var(--fg)]">👋 Welcome to DocPro AI</div>
                  <p className="mt-2">Ask questions about your Knowledge.</p>
                  <p className="mt-4 text-xs font-semibold text-[var(--fg)]">Examples:</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    <li>• Summarize this Knowledge.</li>
                    <li>• What are the key points?</li>
                    <li>• Find information about "..."</li>
                    <li>• Explain the section about "..."</li>
                    <li>• Show the full content of this section.</li>
                    <li>• Which Knowledge covers this topic?</li>
                  </ul>
                  <hr className="my-4 border-[var(--border)]" />
                  <p className="text-xs">
                    AI only answers based on Knowledge you have uploaded.
                  </p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'w-full max-w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm text-white sm:w-auto sm:max-w-[80%]'
                      : 'w-full max-w-full rounded-2xl border border-[var(--border)] bg-[var(--muted)] px-4 py-2.5 text-sm text-[var(--fg)] sm:w-auto sm:max-w-[85%]'
                  }
                >
                  {m.pending ? (
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--mutfg)] [animation-delay:-0.2s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--mutfg)] [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--mutfg)]" />
                    </span>
                  ) : m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none break-words text-[var(--fg)] prose-headings:font-bold prose-headings:text-[var(--fg)] prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:bg-black/80 prose-pre:text-white prose-code:text-pink-300 prose-strong:text-[var(--fg)] prose-a:text-blue-500 prose-table:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}

                  {m.role === 'assistant' && m.continueText && (
                    <button
                      type="button"
                      onClick={() => continueReading(m.continueText!, i)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      ▶ Continue reading
                    </button>
                  )}

                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && !isNoAnswer(m.content) && (
                    <div className="mt-3 border-t border-[var(--border)] pt-2">
                      <div className="mb-1 text-xs font-semibold text-[var(--mutfg)]">Sources:</div>
                      <ul className="space-y-1">
                        {m.sources.map((s, si) => (
                          <li key={si} className="text-xs text-[var(--mutfg)]">
                            <span className="font-medium text-[var(--fg)]">📄 {s.name}</span>
                            {s.path ? <span> · 📁 {s.path}</span> : null}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => speak(m.content, i)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] hover:bg-[var(--card-bg)]"
                      >
                        🔊 Listen to answer
                      </button>
                    </div>
                  )}

                  {m.limitHit && (
                    <div className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
                      Monthly token limit reached. Upgrade your plan for more tokens.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-2 shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-4 flex shrink-0 items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                historyIdx.current = -1
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (history.length === 0) return
                  if (historyIdx.current < 0) draftRef.current = input
                  const next = historyIdx.current < 0 ? history.length - 1 : Math.max(0, historyIdx.current - 1)
                  historyIdx.current = next
                  setInput(history[next])
                  return
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (history.length === 0 || historyIdx.current < 0) return
                  const next = historyIdx.current + 1
                  if (next >= history.length) {
                    historyIdx.current = -1
                    setInput(draftRef.current)
                  } else {
                    historyIdx.current = next
                    setInput(history[next])
                  }
                  return
                }
              }}
              rows={1}
              placeholder="Type your question…"
              className="demo-input w-full resize-none"
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/10 disabled:opacity-60"
              >
                {busy ? '…' : 'Send'}
              </button>
              <label className="hidden items-center gap-1.5 sm:flex" title="Read AI answers aloud automatically">
                <span className="text-xs text-[var(--mutfg)]">AI Voice</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={voiceOn}
                  onClick={() =>
                    setVoiceOn((v) => {
                      const next = !v
                      if (!next) {
                        cancelSpeakRef.current = true
                        audioRef.current?.pause()
                        audioRef.current = null
                        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel()
                        }
                      }
                      return next
                    })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    voiceOn ? 'bg-emerald-600' : 'bg-[var(--muted)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      voiceOn ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        </main>
      </div>

      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={cancelDelete}
        >
          <div
            className="w-80 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--fg)]">Delete chat?</h3>
            <p className="mt-2 text-sm text-[var(--mutfg)]">
              All messages in this chat will be permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
