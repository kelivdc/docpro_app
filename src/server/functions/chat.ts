import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { answerQuestion, continueAnswer, ChatLimitError, type Source } from '../rag/query'
import { textToSpeech, TtsUnavailableError } from '../rag/tts'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export interface ChatPayload {
  question: string
  category?: string
  path?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  documentIds?: string[]
}

export interface TokenCost {
  prompt: number
  completion: number
  total: number
  costUsd: number
  costIdr: number
}

export interface ChatResponse {
  answer: string
  sources: Source[]
  limitHit?: boolean
  truncated?: boolean
  cost?: TokenCost
  raw?: string
}

export const chatAsk = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as ChatPayload
    if (!d?.question || d.question.trim().length === 0) throw new Error('Pertanyaan kosong')
    if (d.question.length > 2000) throw new Error('Pertanyaan terlalu panjang (maks 2000 karakter)')
    return d
  })
  .handler(async ({ data }): Promise<ChatResponse> => {
    const userId = await currentUserId()
    try {
      const res = await answerQuestion(userId, data.question, {
        category: data.category,
        path: data.path,
        history: data.history,
        documentIds: data.documentIds,
      })
      const cost = res.usage
        ? {
            prompt: res.usage.promptTokens,
            completion: res.usage.completionTokens,
            total: res.usage.totalTokens,
            costUsd: res.usage.sumopodCostUsd ?? parseFloat(((res.usage.promptTokens * 0.15 + res.usage.completionTokens * 0.60) / 1_000_000).toFixed(6)),
            costIdr: res.usage.sumopodCostIdr ?? 0,
          }
        : undefined
      if (cost && !res.usage?.sumopodCostIdr) cost.costIdr = parseFloat((cost.costUsd * 16500).toFixed(0))
      const rawStr = res.raw ? JSON.stringify(res.raw) : undefined
      return { answer: res.answer, sources: res.sources, truncated: res.truncated, cost, raw: rawStr }
    } catch (e) {
      if (e instanceof ChatLimitError) return { answer: e.message, sources: [], limitHit: true }
      throw e
    }
  })

// Continue a truncated answer (model hit its output limit).
export const chatContinue = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as {
      question: string
      priorAnswer: string
      category?: string
      path?: string
      history?: { role: 'user' | 'assistant'; content: string }[]
      documentIds?: string[]
    }
    if (!d?.question || !d?.priorAnswer) throw new Error('Pertanyaan dan jawaban sebelumnya diperlukan')
    if (d.question.length > 2000) throw new Error('Pertanyaan terlalu panjang (maks 2000 karakter)')
    return d
  })
  .handler(async ({ data }): Promise<ChatResponse> => {
    const userId = await currentUserId()
    try {
      const res = await continueAnswer(userId, data.question, data.priorAnswer, {
        category: data.category,
        path: data.path,
        history: data.history,
        documentIds: data.documentIds,
      })
      const cost = res.usage
        ? {
            prompt: res.usage.promptTokens,
            completion: res.usage.completionTokens,
            total: res.usage.totalTokens,
            costUsd: res.usage.sumopodCostUsd ?? parseFloat(((res.usage.promptTokens * 0.15 + res.usage.completionTokens * 0.60) / 1_000_000).toFixed(6)),
            costIdr: res.usage.sumopodCostIdr ?? 0,
          }
        : undefined
      if (cost && !res.usage?.sumopodCostIdr) cost.costIdr = parseFloat((cost.costUsd * 16500).toFixed(0))
      const rawStr = res.raw ? JSON.stringify(res.raw) : undefined
      return { answer: res.answer, sources: res.sources, truncated: res.truncated, cost, raw: rawStr }
    } catch (e) {
      if (e instanceof ChatLimitError) return { answer: e.message, sources: [], limitHit: true }
      throw e
    }
  })

export const chatAudio = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { text: string }
    if (!d?.text) throw new Error('Teks kosong')
    return d
  })
  .handler(async ({ data }): Promise<{ audio: string; mime: string } | { error: string }> => {
    const userId = await currentUserId()
    void userId
    try {
      const res = await textToSpeech(data.text)
      return { audio: res.audio.toString('base64'), mime: res.mime }
    } catch (e) {
      if (e instanceof TtsUnavailableError) return { error: e.message }
      throw e
    }
  })
