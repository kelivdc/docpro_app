import { getVectorStore, getTenantContext, getMonthlyTokenUsage, incrementChatUsage } from '../tenant'
import { embed } from '../llm'
import { getLlmProvider, type ChatMessage } from '../llm'
import { chatConfig } from './chat-config'

// Retrieve more candidates than we keep (rerankTopK), rerank by similarity,
// keep the top `topK` base chunks, then expand their parent/child units so the
// LLM sees full logical sections (BAB + Pasal + Ayat) — not just fragments.
// `matched` is true only if at least one BASE candidate passed the similarity
// threshold — used to decide "no relevant document" vs an irrelevant expansion.
async function retrieveReranked(
  userId: string,
  vector: number[],
  opts?: { category?: string; path?: string; documentIds?: string[] },
): Promise<{ hits: any[]; matched: boolean }> {
  const store = await getVectorStore(userId)

  // Phase 1: scout a wider net without expansion.
  const scouted = await store.query(userId, vector, {
    limit: chatConfig.rerankTopK,
    category: opts?.category,
    path: opts?.path,
    expandParents: false,
    focusDocIds: opts?.documentIds,
  })

  // When user explicitly selects documents, keep all their chunks
  // regardless of similarity — the user chose the scope.
  if (opts?.documentIds && opts.documentIds.length > 0) {
    const byDoc = new Map<string, (typeof scouted)[number][]>()
    for (const h of scouted) {
      const arr = byDoc.get(h.documentId)
      if (arr) arr.push(h)
      else byDoc.set(h.documentId, [h])
    }
    const topBase = [...byDoc.values()]
      .flatMap((hits) => hits.sort((a, b) => b.score - a.score).slice(0, chatConfig.topK))
      .sort((a, b) => b.score - a.score)
      .slice(0, chatConfig.topK * 3)
    if (!chatConfig.parentRetrieval) return { hits: topBase, matched: true }
    const expanded = await store.query(userId, vector, {
      limit: chatConfig.topK,
      category: opts?.category,
      path: opts?.path,
      expandParents: true,
      focusDocIds: opts.documentIds,
    })
    const byId = new Map<string, (typeof expanded)[number]>()
    for (const h of [...topBase, ...expanded]) {
      const cur = byId.get(h.id)
      if (!cur || h.score > cur.score) byId.set(h.id, h)
    }
    return { hits: [...byId.values()].sort((a, b) => b.score - a.score), matched: true }
  }

  const candidates = scouted.filter((h) => h.score >= chatConfig.similarityThreshold)

  if (candidates.length === 0) return { hits: [], matched: false }

  // Only keep chunks from the single best-matching document so the LLM
  // doesn't conflate topics across unrelated documents.  The document with
  // the highest-score chunk wins.
  const byDoc = new Map<string, (typeof candidates)[number][]>()
  for (const h of candidates) {
    const arr = byDoc.get(h.documentId)
    if (arr) arr.push(h)
    else byDoc.set(h.documentId, [h])
  }
  const bestDoc = [...byDoc.entries()].sort(
    (a, b) => b[1].reduce((m, h) => Math.max(m, h.score), 0) - a[1].reduce((m, h) => Math.max(m, h.score), 0),
  )[0]
  const topBase = bestDoc[1]
    .sort((a, b) => b.score - a.score)
    .slice(0, chatConfig.topK)

  // Phase 2: expand the chosen base chunks into their full structural units.
  // The vector store expands by parent_id (siblings + children of each base
  // chunk), keeping the context bounded to logical units (Pasal + ayat).
  if (!chatConfig.parentRetrieval) return { hits: topBase, matched: true }
  const expanded = await store.query(userId, vector, {
    limit: chatConfig.topK,
    category: opts?.category,
    path: opts?.path,
    expandParents: true,
    focusDocIds: [bestDoc[0]],
  })
  const byId = new Map<string, (typeof expanded)[number]>()
  for (const h of [...topBase, ...expanded]) {
    const cur = byId.get(h.id)
    if (!cur || h.score > cur.score) byId.set(h.id, h)
  }
  return { hits: [...byId.values()].sort((a, b) => b.score - a.score), matched: true }
}
import { db } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { inArray } from 'drizzle-orm'

export interface Source {
  documentId: string
  name: string
  path: string | null
  category: string | null
  score: number
}

export interface ChatAnswer {
  answer: string
  sources: Source[]
  truncated?: boolean
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; sumopodCostUsd?: number; sumopodCostIdr?: number }
  raw?: unknown
}

export class ChatLimitError extends Error {
  constructor(limit: number, current: number) {
    super(`Batas token bulanan (${current.toLocaleString('id-ID')} / ${limit.toLocaleString('id-ID')}) tercapai. Upgrade paket untuk token lebih banyak.`)
    this.name = 'ChatLimitError'
  }
}

// AD-3 / AD-13: retrieve -> LLM answer -> {answer, sources[]} (sources terpisah).
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// AD: conversational follow-up handling. Before retrieval, rewrite the current
// question into a self-contained "standalone question" when it depends on prior
// turns (e.g. "Nomor 6 bagaimana?" after "Apa isi Pasal 24?"). This standalone
// question — not the raw fragment — is what we embed and retrieve against.
async function rewriteToStandalone(
  userId: string,
  history: ChatTurn[],
  question: string,
): Promise<string> {
  const ctx = await getTenantContext(userId)
  const provider = getLlmProvider(ctx.llmMode)
  const chat = provider.chat.bind(provider)
  const convo = history
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'User' : 'Asisten'}: ${t.content}`)
    .join('\n')
  const system: ChatMessage = {
    role: 'system',
    content:
      'Anda adalah asisten yang mengubah pertanyaan pengguna menjadi pertanyaan mandiri (standalone question) ' +
      'berdasarkan riwayat percakapan. Jika pertanyaan saat ini sudah lengkap dan tidak bergantung pada ' +
      'riwayat, kembalikan apa adanya. Jika merupakan kelanjutan (merujuk pada pertanyaan sebelumnya, ' +
      'menggunakan kata seperti "nomor 6", "yang tadi", "bagaimana dengan"), gabungkan dengan konteks ' +
      'sebelumnya sehingga pertanyaan baru dapat dipahami tanpa riwayat. Hanya keluarkan teks pertanyaan ' +
      'mandiri, tanpa penjelasan atau tanda kutip.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Riwayat percakapan:\n${convo}\n\nPertanyaan saat ini:\n${question}\n\nStandalone question:`,
  }
  const res = await chat([system, user], { temperature: 0, maxTokens: 256 })
  const rewritten = (res.text || '').trim().replace(/^["'`]|["'`]$/g, '')
  return rewritten.length > 0 ? rewritten : question
}

export async function answerQuestion(
  userId: string,
  question: string,
  opts?: { category?: string; path?: string; limit?: number; history?: ChatTurn[]; documentIds?: string[] },
): Promise<ChatAnswer> {
  const ctx = await getTenantContext(userId)

  // AD-12: enforce monthly token limit
  const monthTokens = await getMonthlyTokenUsage(userId)
  if (monthTokens >= ctx.limits.tokenPerMonth) {
    throw new ChatLimitError(ctx.limits.tokenPerMonth, monthTokens)
  }

  // Resolve a standalone question when the conversation has prior turns.
  const effectiveQuestion =
    opts?.history && opts.history.length > 0 ? await rewriteToStandalone(userId, opts.history, question) : question

  const vector = await embed(effectiveQuestion)
  const { hits, matched } = await retrieveReranked(userId, vector, opts)

  if (!matched) {
    await incrementChatUsage(userId)
    return {
      answer: `Terima kasih atas pertanyaan Anda. Saya telah menelusuri seluruh dokumen yang tersedia, namun tidak menemukan informasi yang berkaitan dengan "${question}". Jika berkenan, Anda dapat merumuskan kembali pertanyaan atau memeriksa kembali dokumen yang telah diunggah.`,
      sources: [],
    }
  }

  // Build a clean passage context for the LLM. Metadata (headingPath,
  // document id, chunk index) is used for RETRIEVAL ONLY and is never shown
  // to the user — do not emit raw chunk markers like [Dokumen N] or [BAB IV].
  const context = hits.map((h) => h.content.trim()).join('\n\n')

  const system: ChatMessage = {
    role: 'system',
    content:
      'Anda adalah asisten RAG untuk DocPro. Jawab HANYA berdasarkan konteks dokumen yang diberikan. ' +
      'Jika jawaban tidak ada di konteks, katakan tidak tahu. Jawab dalam Bahasa Indonesia yang jelas, terstruktur, dan ringkas. ' +
      'Gunakan format Markdown untuk keterbacaan: heading (## / ###) untuk topik, daftar bernomor/bullet untuk langkah atau poin, ' +
      'tabel untuk data berdampingan, dan **tebal** untuk istilah kunci. Jangan sertakan nama file atau path di dalam jawaban; ' +
      'sumber akan ditampilkan terpisah. Metadata internal (id dokumen, indeks chunk, heading path) bersifat rahasia dan ' +
      'hanya untuk referensi sistem — JANGAN tampilkan metadata tersebut atau potongan chunk mentah apa pun di jawaban.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Pertanyaan: ${question}\n\nKonteks dokumen:\n${context}`,
  }

  const provider = getLlmProvider(ctx.llmMode)
  const result = await provider.chat([system, user], {
    temperature: chatConfig.temperature,
    maxTokens: chatConfig.maxTokens,
  })

  // Build sources (nama file + path) — AD-13: terpisah dari answer.
  // One source per document, keeping the highest-scoring chunk.
  const bestByDoc = new Map<string, { hit: (typeof hits)[number]; docId: string }>()
  for (const h of hits) {
    const cur = bestByDoc.get(h.documentId)
    if (!cur || h.score > cur.hit.score) bestByDoc.set(h.documentId, { hit: h, docId: h.documentId })
  }
  const docIds = [...bestByDoc.keys()]
  const docRows = await db.query.documents.findMany({ where: inArray(documents.id, docIds) })
  const byId = new Map(docRows.map((d) => [d.id, d]))
  const sources: Source[] = [...bestByDoc.values()]
    .sort((a, b) => b.hit.score - a.hit.score)
    .map(({ hit }) => {
      const d = byId.get(hit.documentId)
      return {
        documentId: hit.documentId,
        name: d?.name ?? 'Dokumen',
        path: d?.path ?? null,
        category: d?.category ?? null,
        score: hit.score,
      }
    })

  const usageCost = result.usage
    ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.sumopodCostUsd ?? parseFloat(((result.usage.promptTokens * 0.15 + result.usage.completionTokens * 0.60) / 1_000_000).toFixed(6)),
        costIdr: result.usage.sumopodCostIdr ?? 0,
      }
    : undefined
  if (usageCost && !result.usage?.sumopodCostIdr) usageCost.costIdr = parseFloat((usageCost.costUsd * 16500).toFixed(0))
  await incrementChatUsage(userId, usageCost)
  return { answer: result.text, sources, truncated: result.truncated, usage: result.usage, raw: result.raw }
}

// Continue a previously truncated answer. Re-retrieves context and instructs the
// LLM to continue from where it stopped WITHOUT repeating what was already said.
export async function continueAnswer(
  userId: string,
  question: string,
  priorAnswer: string,
  opts?: { category?: string; path?: string; limit?: number; history?: ChatTurn[]; documentIds?: string[] },
): Promise<ChatAnswer> {
  const ctx = await getTenantContext(userId)
  const monthTokens = await getMonthlyTokenUsage(userId)
  if (monthTokens >= ctx.limits.tokenPerMonth) throw new ChatLimitError(ctx.limits.tokenPerMonth, monthTokens)

  const effectiveQuestion =
    opts?.history && opts.history.length > 0 ? await rewriteToStandalone(userId, opts.history, question) : question
  const vector = await embed(effectiveQuestion)
  const { hits, matched } = await retrieveReranked(userId, vector, opts)
  const context = (matched ? hits : []).map((h) => h.content.trim()).join('\n\n')

  const system: ChatMessage = {
    role: 'system',
    content:
      'Anda adalah asisten RAG untuk DocPro yang MELANJUTKAN jawaban yang terpotong. ' +
      'Lanjutkan TEPAT dari akhir teks sebelumnya. JANGAN mengulang bagian yang sudah ditulis. ' +
      'Gunakan format Markdown yang konsisten dengan bagian sebelumnya (heading, daftar, tabel, **tebal**). ' +
      'Jawab HANYA berdasarkan konteks dokumen. Metadata internal bersifat rahasia — JANGAN tampilkan.',
  }
  const user: ChatMessage = {
    role: 'user',
    content:
      `Pertanyaan: ${effectiveQuestion}\n\n` +
      `Konteks dokumen:\n${context}\n\n` +
      `Jawaban SEBELUMNYA (lanjutkan dari akhir ini, jangan ulangi):\n${priorAnswer}\n\n` +
      `LANJUTKAN:`,
  }

  const provider = getLlmProvider(ctx.llmMode)
  const result = await provider.chat([system, user], {
    temperature: chatConfig.temperature,
    maxTokens: chatConfig.maxTokens,
  })

  // sources for the continuation come from the same retrieval.
  const bestByDoc = new Map<string, { hit: (typeof hits)[number]; docId: string }>()
  for (const h of hits) {
    const cur = bestByDoc.get(h.documentId)
    if (!cur || h.score > cur.hit.score) bestByDoc.set(h.documentId, { hit: h, docId: h.documentId })
  }
  const docIds = [...bestByDoc.keys()]
  const docRows = await db.query.documents.findMany({ where: inArray(documents.id, docIds) })
  const byId = new Map(docRows.map((d) => [d.id, d]))
  const sources: Source[] = [...bestByDoc.values()]
    .sort((a, b) => b.hit.score - a.hit.score)
    .map(({ hit }) => {
      const d = byId.get(hit.documentId)
      return {
        documentId: hit.documentId,
        name: d?.name ?? 'Dokumen',
        path: d?.path ?? null,
        category: d?.category ?? null,
        score: hit.score,
      }
    })

  const usageCostCont = result.usage
    ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.usage.sumopodCostUsd ?? parseFloat(((result.usage.promptTokens * 0.15 + result.usage.completionTokens * 0.60) / 1_000_000).toFixed(6)),
        costIdr: result.usage.sumopodCostIdr ?? 0,
      }
    : undefined
  if (usageCostCont && !result.usage?.sumopodCostIdr) usageCostCont.costIdr = parseFloat((usageCostCont.costUsd * 16500).toFixed(0))
  await incrementChatUsage(userId, usageCostCont)
  return { answer: result.text, sources, truncated: result.truncated, usage: result.usage, raw: result.raw }
}

// Streaming variant (AD-10). Yields answer tokens; sources resolved at end.
export async function* streamAnswer(
  userId: string,
  question: string,
  opts?: { category?: string; path?: string; limit?: number },
): AsyncGenerator<string, ChatAnswer, unknown> {
  const ctx = await getTenantContext(userId)
  const monthTokens = await getMonthlyTokenUsage(userId)
  if (monthTokens >= ctx.limits.tokenPerMonth) throw new ChatLimitError(ctx.limits.tokenPerMonth, monthTokens)

  const vector = await embed(question)
  const { hits, matched } = await retrieveReranked(userId, vector, opts)

  if (!matched) {
    await incrementChatUsage(userId)
    const msg =
      'Maaf, saya tidak menemukan informasi terkait di dokumen Anda. Pastikan dokumen sudah diunggah, berstatus "Siap", dan bukan file hasil pindaan (scan) tanpa teks.'
    yield msg
    return { answer: msg, sources: [] }
  }

  // Build a clean passage context for the LLM. Metadata (headingPath,
  // document id, chunk index) is used for RETRIEVAL ONLY and is never shown
  // to the user — do not emit raw chunk markers like [Dokumen N] or [BAB IV].
  const context = hits.map((h) => h.content.trim()).join('\n\n')
  const system: ChatMessage = {
    role: 'system',
    content:
      'Anda adalah asisten RAG untuk DocPro. Jawab HANYA berdasarkan konteks dokumen yang diberikan. ' +
      'Jika jawaban tidak ada di konteks, katakan tidak tahu. Jawab dalam Bahasa Indonesia yang jelas, terstruktur, dan ringkas. ' +
      'Gunakan format Markdown untuk keterbacaan: heading (## / ###) untuk topik, daftar bernomor/bullet untuk langkah atau poin, ' +
      'tabel untuk data berdampingan, dan **tebal** untuk istilah kunci. Jangan sertakan nama file atau path di dalam jawaban; ' +
      'sumber akan ditampilkan terpisah. Metadata internal (id dokumen, indeks chunk, heading path) bersifat rahasia dan ' +
      'hanya untuk referensi sistem — JANGAN tampilkan metadata tersebut atau potongan chunk mentah apa pun di jawaban.',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `Pertanyaan: ${question}\n\nKonteks dokumen:\n${context}`,
  }

  const provider = getLlmProvider(ctx.llmMode)
  let full = ''
  for await (const tok of provider.stream([system, user], {
    temperature: chatConfig.temperature,
    maxTokens: chatConfig.maxTokens,
  })) {
    full += tok
    yield tok
  }

  const bestByDoc = new Map<string, { hit: (typeof hits)[number]; docId: string }>()
  for (const h of hits) {
    const cur = bestByDoc.get(h.documentId)
    if (!cur || h.score > cur.hit.score) bestByDoc.set(h.documentId, { hit: h, docId: h.documentId })
  }
  const docIds = [...bestByDoc.keys()]
  const docRows = await db.query.documents.findMany({ where: inArray(documents.id, docIds) })
  const byId = new Map(docRows.map((d) => [d.id, d]))
  const sources: Source[] = [...bestByDoc.values()]
    .sort((a, b) => b.hit.score - a.hit.score)
    .map(({ hit }) => {
      const d = byId.get(hit.documentId)
      return {
        documentId: hit.documentId,
        name: d?.name ?? 'Dokumen',
        path: d?.path ?? null,
        category: d?.category ?? null,
        score: hit.score,
      }
    })

  await incrementChatUsage(userId)
  return { answer: full, sources }
}
