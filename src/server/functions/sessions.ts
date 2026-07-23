import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { db } from '../../lib/db'
import { chatSessions, chatMessages, type MessageCost } from '../../lib/schema/chat'
import { eq, and, desc } from 'drizzle-orm'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export interface SessionRow {
  id: string
  userId: string
  title: string
  documentIds: string[] | null
  createdAt: string
  updatedAt: string
}

export interface Source {
  documentId: string
  name: string
  path: string | null
  category: string | null
  score: number
}

export interface MessageRow {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[] | null
  cost: MessageCost | null
  createdAt: string
}

export const listSessions = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await currentUserId()
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
  return rows.map(mapSession)
})

export const createSession = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { title?: string; documentIds?: string[] }
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const [row] = await db
      .insert(chatSessions)
      .values({ userId, title: data.title ?? 'Percakapan Baru', documentIds: data.documentIds ?? null })
      .returning()
    return mapSession(row)
  })

export const renameSession = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; title: string }
    if (!d?.id || !d?.title?.trim()) throw new Error('ID dan judul diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const [row] = await db
      .update(chatSessions)
      .set({ title: data.title.trim(), updatedAt: new Date() })
      .where(and(eq(chatSessions.id, data.id), eq(chatSessions.userId, userId)))
      .returning()
    if (!row) throw new Error('Sesi tidak ditemukan')
    return mapSession(row)
  })

export const deleteSession = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID sesi diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, data.id), eq(chatSessions.userId, userId)))
    return { ok: true }
  })

export const getSessionMessages = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID sesi diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, data.id),
    })
    if (!session || session.userId !== userId) throw new Error('Sesi tidak ditemukan')
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, data.id))
      .orderBy(chatMessages.createdAt)
    return rows.map(mapMessage)
  })

export const saveSessionMessages = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as {
      sessionId: string
      messages: { role: 'user' | 'assistant'; content: string; sources?: Source[] | null; cost?: MessageCost | null }[]
      documentIds?: string[]
    }
    if (!d?.sessionId || !d?.messages) throw new Error('Data sesi dan pesan diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, data.sessionId),
    })
    if (!session || session.userId !== userId) throw new Error('Sesi tidak ditemukan')

    // Delete old messages and re-insert
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, data.sessionId))
    if (data.messages.length > 0) {
      await db.insert(chatMessages).values(
        data.messages.map((m) => ({
          sessionId: data.sessionId,
          role: m.role,
          content: m.content,
          sources: m.sources ? JSON.parse(JSON.stringify(m.sources)) : null,
          cost: m.cost ? JSON.parse(JSON.stringify(m.cost)) : null,
        })),
      )
    }
    // Auto-name session from first user message if still default
    const firstUser = data.messages.find((m) => m.role === 'user')
    const title =
      firstUser && (session.title === 'New Chat' || !session.title)
        ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '…' : '')
        : undefined
    await db
      .update(chatSessions)
      .set({
        updatedAt: new Date(),
        ...(title !== undefined ? { title } : {}),
        ...(data.documentIds !== undefined
          ? { documentIds: data.documentIds.length > 0 ? data.documentIds : null }
          : {}),
      })
      .where(eq(chatSessions.id, data.sessionId))
    return { ok: true }
  })

export const getSession = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID sesi diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const row = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, data.id),
    })
    if (!row || row.userId !== userId) throw new Error('Sesi tidak ditemukan')
    return mapSession(row)
  })

export const getLastSession = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await currentUserId()
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1)
  if (!row) return null
  return mapSession(row)
})

function mapSession(row: typeof chatSessions.$inferSelect): SessionRow {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    documentIds: row.documentIds ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapMessage(row: typeof chatMessages.$inferSelect): MessageRow {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    sources: row.sources as Source[] | null,
    cost: row.cost as MessageCost | null,
    createdAt: row.createdAt.toISOString(),
  }
}
