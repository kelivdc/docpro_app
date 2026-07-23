async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`LLM upstream ${url} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

const DIM = EMBED_DIM

// Deterministic local embedding fallback when no upstream EMBEDDING_URL is set.
// Lets the pipeline run end-to-end in dev/offline (replaced by real API in prod).
function localEmbed(text: string): number[] {
  const vec = new Array(DIM).fill(0)
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? []
  for (const t of tokens) {
    let h = 2166136261
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % DIM
    vec[idx] += 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

// Extractive local answer fallback when no LLM upstream is reachable.
// Returns the most relevant context (the user message carries the doc context).
function localAnswer(messages: ChatMessage[]): ChatResult {
  const userMsg = messages.find((m) => m.role === 'user')?.content ?? ''
  const idx = userMsg.indexOf('Konteks dokumen:')
  const context = idx >= 0 ? userMsg.slice(idx + 'Konteks dokumen:'.length) : userMsg
  const snippet = context.split('\n').filter((l) => l.trim().length > 0).slice(0, 6).join(' ').trim()
  if (!snippet) return { text: 'Maaf, saya tidak menemukan informasi terkait di dokumen Anda.', truncated: false }
  return { text: `Berdasarkan dokumen Anda: ${snippet.slice(0, 600)}`, truncated: false }
}

import { EMBED_DIM } from '../lib/schema/documents'

// AD-9: embeddings via OpenAI-compatible API (OpenAI/Azure/Ollama).
// Ollama single: POST /api/embeddings {model, prompt} -> {embedding:[...]}
// Ollama batch : POST /api/embed      {model, input:[...]} -> {embeddings:[[...]]}
// OpenAI        : POST /v1/embeddings {model, input} -> {data:[{embedding:[...]}]}
function isOllama(url: string) {
  return /ollama|11434|:11434/.test(url)
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  if (norm === 0 || norm === 1) return vec
  return vec.map((v) => v / norm)
}

export async function embed(text: string): Promise<number[]> {
  const url = process.env.EMBEDDING_URL
  if (!url) return localEmbed(text)
  const key = process.env.EMBEDDING_KEY
  const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
  const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {}
  try {
    // Ollama single-embeddings endpoint uses `prompt`, not `input`.
    const data = await postJson(url, headers, isOllama(url) ? { model, prompt: text } : { model, input: text })
    if (Array.isArray(data?.embedding) && data.embedding.length) return normalize(data.embedding as number[])
    if (Array.isArray(data?.data) && data.data[0]?.embedding) return normalize(data.data[0].embedding as number[])
    return localEmbed(text)
  } catch {
    return localEmbed(text)
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const url = process.env.EMBEDDING_URL
  if (!url) return texts.map(localEmbed)
  const key = process.env.EMBEDDING_KEY
  const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
  const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {}
  try {
    if (isOllama(url)) {
      // Ollama batch endpoint: /api/embed with `input` array.
      const batchUrl = url.replace(/\/api\/embeddings$/, '/api/embed')
      const data = await postJson(batchUrl, headers, { model, input: texts })
      if (Array.isArray(data?.embeddings) && data.embeddings.length) {
        return data.embeddings as number[][]
      }
    } else {
      const data = await postJson(url, headers, { model, input: texts })
      if (Array.isArray(data?.data) && data.data[0]?.embedding) {
        return (data.data as Array<{ embedding: number[] }>).map((d) => d.embedding)
      }
    }
  } catch {
    // fall through to one-by-one fallback below
  }

  // Fallback: embed one-by-one via the single endpoint (handles batching
  // when the batch endpoint rejects large payloads, e.g. Ollama 400).
  const out: number[][] = []
  for (const t of texts) {
    const v = await embed(t)
    out.push(v)
  }
  return out
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

// Result of a chat completion, including whether the model hit its output limit
// (finish_reason === "length") so the caller can auto-continue the answer.
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  // Cost langsung dari response Sumopod (jika ada)
  sumopodCostUsd?: number
  sumopodCostIdr?: number
}

export interface ChatResult {
  text: string
  truncated: boolean
  usage?: TokenUsage
  raw?: unknown
}

// AD-2 / AD-10: LLM Factory — cloud (OpenAI-compatible) or Ollama (llm_mode).
export interface LlmProvider {
  chat(messages: ChatMessage[], opts?: CompletionOptions): Promise<ChatResult>
  // Stream tokens from the model internally, but resolve with the full text and
  // whether the model hit its output limit (finish_reason === "length").
  streamChat(messages: ChatMessage[], opts?: CompletionOptions): Promise<ChatResult>
  stream(messages: ChatMessage[], opts?: CompletionOptions): AsyncIterable<string>
}

class CloudLlm implements LlmProvider {
  // Normalize a base URL (e.g. https://host) to the OpenAI chat-completions path.
  private endpoint(): string {
    const u = this.url.replace(/\/+$/, '')
    if (u.endsWith('/chat/completions')) return u
    if (u.endsWith('/v1')) return `${u}/chat/completions`
    return `${u}/v1/chat/completions`
  }

  constructor(
    private url: string,
    private key: string | undefined,
    private model: string,
  ) {}

  async chat(messages: ChatMessage[], opts?: CompletionOptions): Promise<ChatResult> {
    try {
      const data = await postJson(
        this.endpoint(),
        this.key ? { Authorization: `Bearer ${this.key}` } : {},
        {
          model: opts?.model ?? this.model,
          messages,
          temperature: opts?.temperature ?? 0.2,
          max_tokens: opts?.maxTokens ?? 2048,
        },
      )
      const choice = data?.choices?.[0]
      const text = choice?.message?.content
      if (typeof text === 'string' && text.trim()) {
        const us = data?.usage
        let usage: TokenUsage | undefined
        if (us) {
          usage = { promptTokens: us.prompt_tokens, completionTokens: us.completion_tokens, totalTokens: us.total_tokens }
          if (typeof us.cost === 'number') {
            usage.sumopodCostUsd = us.cost
            usage.sumopodCostIdr = parseFloat((us.cost * 16500).toFixed(0))
          }
        }
        return { text, truncated: choice?.finish_reason === 'length', usage, raw: data }
      }
      return localAnswer(messages)
    } catch {
      return localAnswer(messages)
    }
  }

  async streamChat(
    messages: ChatMessage[],
    opts?: CompletionOptions,
  ): Promise<ChatResult> {
    try {
      const res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}),
        },
        body: JSON.stringify({
          model: opts?.model ?? this.model,
          messages,
          temperature: opts?.temperature ?? 0.1,
          max_tokens: opts?.maxTokens ?? 2048,
          stream: true,
        }),
      })
       if (!res.ok || !res.body) return localAnswer(messages)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let full = ''
      let truncated = false
      let usage: TokenUsage | undefined
      const rawChunks: unknown[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.replace(/^data:\s*/, '').trim()
          if (!t || t === '[DONE]') continue
          try {
            const json = JSON.parse(t)
            rawChunks.push(json)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) full += delta
            if (json.choices?.[0]?.finish_reason === 'length') truncated = true
            if (json.usage) {
              const u = json.usage
              usage = { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens }
              if (typeof u.cost === 'number') {
                usage.sumopodCostUsd = u.cost
                usage.sumopodCostIdr = parseFloat((u.cost * 16500).toFixed(0))
              }
            }
          } catch {
            /* ignore partial */
          }
        }
      }
      if (full.trim()) {
        if (!usage) {
          const estimatedCompletion = Math.ceil(full.length / 4)
          usage = { promptTokens: 0, completionTokens: estimatedCompletion, totalTokens: estimatedCompletion }
        }
        return { text: full, truncated, usage, raw: rawChunks }
      }
      return localAnswer(messages)
    } catch {
      return localAnswer(messages)
    }
  }

  async *stream(messages: ChatMessage[], opts?: CompletionOptions): AsyncIterable<string> {
    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}),
      },
      body: JSON.stringify({
        model: opts?.model ?? this.model,
        messages,
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 2048,
        stream: true,
      }),
    })
    if (!res.ok || !res.body) throw new Error(`LLM stream failed: ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const t = line.replace(/^data:\s*/, '').trim()
        if (!t || t === '[DONE]') continue
        try {
          const json = JSON.parse(t)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta as string
        } catch {
          /* ignore partial */
        }
      }
    }
  }
}

class OllamaLlm implements LlmProvider {
  constructor(private base: string, private model: string) {}

  async chat(messages: ChatMessage[], opts?: CompletionOptions): Promise<ChatResult> {
    const data = await postJson(
      `${this.base}/api/chat`,
      {},
      { model: opts?.model ?? this.model, messages, stream: false },
    )
    return { text: (data.message?.content as string) ?? '', truncated: false }
  }

  async streamChat(
    messages: ChatMessage[],
    opts?: CompletionOptions,
  ): Promise<ChatResult> {
    let full = ''
    for await (const delta of this.stream(messages, opts)) full += delta
    return { text: full, truncated: false }
  }

  async *stream(messages: ChatMessage[], opts?: CompletionOptions): AsyncIterable<string> {
    const res = await fetch(`${this.base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts?.model ?? this.model,
        messages,
        stream: true,
      }),
    })
    if (!res.ok || !res.body) throw new Error(`Ollama stream failed: ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const t = line.trim()
        if (!t) continue
        try {
          const json = JSON.parse(t)
          if (json.message?.content) yield json.message.content as string
        } catch {
          /* ignore partial */
        }
      }
    }
  }
}

export function getLlmProvider(mode: 'cloud' | 'ollama' = 'cloud'): LlmProvider {
  if (mode === 'ollama') {
    const base = process.env.OLLAMA_URL ?? 'http://localhost:11434'
    return new OllamaLlm(base, process.env.OLLAMA_MODEL ?? 'llama3.1')
  }
  const url = process.env.AI_URL
  const key = process.env.AI_KEY
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini'
  if (!url) throw new Error('AI_URL is not set')
  return new CloudLlm(url, key, model)
}
