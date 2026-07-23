import { randomBytes } from 'crypto'
import { db } from '../lib/db'
import { shareLinks, documents } from '../lib/schema/documents'
import { eq, and, isNull, gt, desc, sql } from 'drizzle-orm'

export interface ShareView {
  id: string
  documentId: string
  documentName: string
  token: string
  mode: string
  shareWith: string[] | null
  expiresAt: string | null
  createdAt: string | Date
  ownerId: string
}

function makeToken(): string {
  return randomBytes(16).toString('hex')
}

export async function listShares(ownerId: string): Promise<ShareView[]> {
  const rows = await db
    .select({
      id: shareLinks.id,
      documentId: shareLinks.documentId,
      documentName: documents.name,
      token: shareLinks.token,
      mode: shareLinks.mode,
      shareWith: shareLinks.shareWith,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
      ownerId: shareLinks.ownerId,
    })
    .from(shareLinks)
    .innerJoin(documents, eq(shareLinks.documentId, documents.id))
    .where(eq(shareLinks.ownerId, ownerId))
    .orderBy(desc(shareLinks.createdAt))
  return rows as unknown as ShareView[]
}

export async function listSharedWithMe(email: string): Promise<ShareView[]> {
  const rows = await db
    .select({
      id: shareLinks.id,
      documentId: shareLinks.documentId,
      documentName: documents.name,
      token: shareLinks.token,
      mode: shareLinks.mode,
      shareWith: shareLinks.shareWith,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
      ownerId: shareLinks.ownerId,
    })
    .from(shareLinks)
    .innerJoin(documents, eq(shareLinks.documentId, documents.id))
    .where(
      and(
        eq(shareLinks.mode, 'user'),
        sql`${shareLinks.shareWith} @> ARRAY[${email}]`,
      ),
    )
    .orderBy(desc(shareLinks.createdAt))
  return rows as unknown as ShareView[]
}

export async function createShare(
  ownerId: string,
  data: { documentId: string; mode?: string; shareWith?: string[]; expiresAt?: string | null },
): Promise<{ id: string; token: string }> {
  // verify ownership
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, data.documentId), eq(documents.ownerId, ownerId)),
  })
  if (!doc) throw new Error('Dokumen tidak ditemukan')

  const id = randomBytes(8).toString('hex')
  const token = makeToken()
  await db.insert(shareLinks).values({
    id,
    documentId: data.documentId,
    ownerId,
    token,
    mode: data.mode ?? 'public',
    shareWith: data.shareWith ?? null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
  })
  return { id, token }
}

export async function revokeShare(ownerId: string, id: string): Promise<void> {
  await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.id, id), eq(shareLinks.ownerId, ownerId)))
}

// Public read (no auth) — used by /share/:token viewer.
export async function getSharedDocument(token: string) {
  const link = await db.query.shareLinks.findFirst({
    where: and(
      eq(shareLinks.token, token),
      isNull(shareLinks.expiresAt),
    ),
  })
  if (!link) {
    // check non-expired
    const l2 = await db.query.shareLinks.findFirst({
      where: and(eq(shareLinks.token, token), gt(shareLinks.expiresAt, new Date())),
    })
    if (!l2) return null
    return resolveDoc(l2)
  }
  return resolveDoc(link)
}

async function resolveDoc(link: typeof shareLinks.$inferSelect) {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, link.documentId),
  })
  if (!doc || doc.hidden || doc.expired) return null
  return {
    name: doc.name,
    category: doc.category,
    path: doc.path,
    note: doc.note,
    mode: link.mode,
    shareWith: link.shareWith,
  }
}
