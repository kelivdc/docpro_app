import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import {
  listShares,
  listSharedWithMe,
  createShare,
  revokeShare,
  getSharedDocument,
  type ShareView,
} from '../share-service'
import { db } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { eq, desc } from 'drizzle-orm'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

function currentUserEmail(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const email = s?.user?.email
      if (!email) throw new Error('UNAUTHENTICATED')
      return email
    })
}

export type { ShareView }

export const listSharesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [userId, email] = await Promise.all([currentUserId(), currentUserEmail()])
  const [owned, sharedWithMe] = await Promise.all([
    listShares(userId),
    listSharedWithMe(email),
  ])
  return { owned, sharedWithMe }
})

export const listOwnDocuments = createServerFn({ method: 'GET' }).handler(async () => {
  const ownerId = await currentUserId()
  return db
    .select({ id: documents.id, name: documents.name, category: documents.category })
    .from(documents)
    .where(eq(documents.ownerId, ownerId))
    .orderBy(desc(documents.createdAt))
})

export const createShareFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { documentId: string; mode?: string; shareWith?: string[]; expiresAt?: string | null }
    if (!d?.documentId) throw new Error('Pilih dokumen')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    return createShare(ownerId, data)
  })

export const revokeShareFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('id wajib')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    await revokeShare(ownerId, data.id)
    return { ok: true }
  })

// Public (no auth) — for /share/:token viewer.
export const getSharedDocumentFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { token: string }
    if (!d?.token) throw new Error('token wajib')
    return d
  })
  .handler(async ({ data }) => {
    return getSharedDocument(data.token)
  })
