import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { ingestDocument } from '../ingest/pipeline'
import { fetchWebsite } from '../ingest/fetch-website'
import { db } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { eq, desc } from 'drizzle-orm'
import type { IntelligenceScore } from '../ingest/types'
import { getTenantContext, getVectorStore } from '../tenant'
import { deleteObject, getPresignedUrl } from '../minio'
import { getOrCreateDefaultWorkspace } from '../workspace-service'
import { categoryExists } from '../categories-service'
import { and } from 'drizzle-orm'

export interface UploadPayload {
  name: string
  workspaceId?: string
  mime?: string
  size?: number
  base64?: string
  content?: string
  category?: string | null
  note?: string
  path?: string
  sourceType?: string
  hidden?: boolean
  expired?: boolean
  expiredAt?: string | null
}

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export const uploadDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as UploadPayload
    if (!d?.name) throw new Error('Name is required')
    if (d.base64 && d.size && d.size > 150 * 1024 * 1024) throw new Error('Maximum size is 150 MB')
    if (!d.base64 && !d.content) throw new Error('File or content is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    let file: { name: string; mime: string; size: number; buffer: Buffer }

    if (data.sourceType === 'website' && data.content) {
      const page = await fetchWebsite(data.content)
      const buf = Buffer.from(page.text, 'utf-8')
      file = {
        name: page.title + '.txt',
        mime: 'text/plain',
        size: buf.length,
        buffer: buf,
      }
    } else if (data.content) {
      const buf = Buffer.from(data.content, 'utf-8')
      const ext = data.sourceType === 'manual' ? '.txt' : data.sourceType === 'website' ? '.html' : '.txt'
      file = {
        name: data.name.endsWith(ext) ? data.name : data.name + ext,
        mime: data.mime || (data.sourceType === 'website' ? 'text/html' : 'text/plain'),
        size: buf.length,
        buffer: buf,
      }
    } else {
      file = {
        name: data.name,
        mime: data.mime || 'application/octet-stream',
        size: data.size || 0,
        buffer: Buffer.from(data.base64!, 'base64'),
      }
    }

    const workspaceId = await resolveWorkspace(ownerId, data.workspaceId)
    // AD-WS-9: reject a category that is not a (workspaceId, name) row in the SAME workspace.
    if (data.category) {
      const exists = await categoryExists(ownerId, workspaceId, data.category)
      if (!exists) throw new Error(`Category "${data.category}" does not exist in this workspace`)
    }

    const result = await ingestDocument({
      ownerId,
      workspaceId,
      file,
      category: data.category,
      note: data.note,
      path: data.path,
      sourceType: data.sourceType,
      hidden: data.hidden,
      expired: data.expired,
      expiredAt: data.expiredAt,
    })
    return result
  })

// AD-WS-5: resolve the requested workspace or fall back to the owner's default.
async function resolveWorkspace(ownerId: string, workspaceId?: string): Promise<string> {
  if (workspaceId) return workspaceId
  return (await getOrCreateDefaultWorkspace(ownerId)).id
}

export const getDocument = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')
    return {
      ...doc,
      intelligenceScore: (doc.intelligenceScore ?? null) as any,
      structureJson: (doc.structureJson ?? null) as any,
    }
  })

export const listDocuments = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { workspaceId: string }
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.ownerId, ownerId), eq(documents.workspaceId, data.workspaceId)))
      .orderBy(desc(documents.createdAt))
    // jsonb columns deserialize as `unknown`; cast so the server fn result is serializable.
    return rows.map((r) => ({
      ...r,
      intelligenceScore: (r.intelligenceScore ?? null) as IntelligenceScore | null,
      structureJson: (r.structureJson ?? null) as any,
    }))
  })

// Delete document: documents + chunks (tenant schema) rows + MinIO object.
export const deleteDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')

    await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.workspaceId, data.id))
    const ctx = await getTenantContext(ownerId)
    if (doc.objectKey) await deleteObject(ctx.bucket, doc.objectKey)
    await db.delete(documents).where(eq(documents.id, data.id))
    return { ok: true }
  })

// Update document: change category or re-upload file.
export const updateDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as {
      id: string
      workspaceId: string
      category?: string | null
      sourceType?: string
      name?: string
      mime?: string
      size?: number
      base64?: string
    }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    if (d.base64 && d.size && d.size > 150 * 1024 * 1024) throw new Error('Maximum size is 150 MB')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')

    // AD-WS-9: validate the new category belongs to this workspace before applying.
    const nextCategory = data.category !== undefined ? data.category : doc.category
    if (nextCategory) {
      const exists = await categoryExists(ownerId, data.workspaceId, nextCategory)
      if (!exists) throw new Error(`Category "${nextCategory}" does not exist in this workspace`)
    }

    // If a new file is provided, re-ingest (delete old chunks/minio, upload new).
    if (data.base64) {
      const buffer = Buffer.from(data.base64, 'base64')
      // Remove old vector chunks
      await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.workspaceId, data.id))
      // Remove old MinIO object (must succeed before re-ingesting — no orphan)
      const ctx = await getTenantContext(ownerId)
      if (doc.objectKey) {
        const { deleteObject } = await import('../minio')
        await deleteObject(ctx.bucket, doc.objectKey)
      }
      // Re-ingest with the same document ID (workspaceId is preserved — AD-WS-5)
      return ingestDocument({
        ownerId,
        workspaceId: doc.workspaceId,
        file: { name: data.name ?? doc.name, mime: data.mime ?? 'application/octet-stream', size: data.size ?? buffer.length, buffer },
        category: data.category !== undefined ? data.category : doc.category,
        note: doc.note ?? undefined,
        path: doc.path ?? undefined,
        sourceType: data.sourceType !== undefined ? data.sourceType : (doc.sourceType ?? 'document'),
        hidden: doc.hidden,
        expired: !!doc.expiredAt,
        expiredAt: doc.expiredAt ? doc.expiredAt.toISOString() : null,
        documentId: data.id,
      })
    }

    // Otherwise just update metadata (category, sourceType, etc).
    const updateData: Record<string, unknown> = {}
    if (data.category !== undefined) updateData.category = data.category
    if (data.sourceType !== undefined) updateData.sourceType = data.sourceType
    if (Object.keys(updateData).length > 0) {
      await db
        .update(documents)
        .set(updateData)
        .where(eq(documents.id, data.id))
    }
    return { documentId: data.id, status: 'ready', chunks: 0 }
  })

// Toggle document visibility.
export const toggleHiddenDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string; hidden: boolean }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')
    await db
      .update(documents)
      .set({ hidden: data.hidden })
      .where(eq(documents.id, data.id))
    return { ok: true, hidden: data.hidden }
  })

// Reprocess an existing document (fetch file from MinIO, re-index with the latest parser).
export const reprocessDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')
    if (!doc.objectKey) throw new Error('File object not available')

    // Fetch file from MinIO (via getObject)
    const { getObject } = await import('../minio')
    const ctx = await getTenantContext(ownerId)
    const fileBuf = await getObject(ctx.bucket, doc.objectKey)
    if (!fileBuf) throw new Error('File not found in storage')

    // Remove old chunks
    await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.workspaceId, data.id))

    // Reset document status to processing before re-ingest
    await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, data.id))

    // Re-ingest with the same documentId (the latest parser will be used)
    const result = await ingestDocument({
      ownerId,
      workspaceId: doc.workspaceId,
      file: { name: doc.name, mime: doc.mime ?? 'application/pdf', size: fileBuf.length, buffer: fileBuf },
      category: doc.category,
      note: doc.note ?? undefined,
      path: doc.path ?? undefined,
      sourceType: doc.sourceType ?? 'document',
      hidden: doc.hidden,
      expired: !!doc.expiredAt,
      expiredAt: doc.expiredAt ? doc.expiredAt.toISOString() : null,
      documentId: data.id,
    })
    return result
  })

// Temporary (presigned) download URL for the document.
export const downloadDocumentUrl = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')
    if (!doc.objectKey) throw new Error('Object not available')
    const ctx = await getTenantContext(ownerId)
    const url = await getPresignedUrl(ctx.bucket, doc.objectKey, 60 * 10)
    return { url, name: doc.name }
  })

export const getDocumentContent = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('Document ID is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, data.id), eq(documents.ownerId, ownerId)),
    })
    if (!doc || doc.workspaceId !== data.workspaceId) throw new Error('Document not found')
    if (!doc.objectKey) return { content: null }
    const ctx = await getTenantContext(ownerId)
    const { getObject } = await import('../minio')
    try {
      const buf = await getObject(ctx.bucket, doc.objectKey)
      const content = buf.toString('utf-8')
      return { content }
    } catch {
      return { content: null }
    }
  })
