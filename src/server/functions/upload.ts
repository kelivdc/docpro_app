import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { ingestDocument } from '../ingest/pipeline'
import { db } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { eq, desc } from 'drizzle-orm'
import type { IntelligenceScore } from '../ingest/types'
import { getTenantContext, getVectorStore } from '../tenant'
import { deleteObject, getPresignedUrl } from '../minio'

export interface UploadPayload {
  name: string
  mime?: string
  size?: number
  base64?: string
  content?: string
  category?: string | null
  note?: string
  path?: string
  sourceType?: string
  share?: string
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
    if (!d?.name) throw new Error('Nama diperlukan')
    if (d.base64 && d.size && d.size > 150 * 1024 * 1024) throw new Error('Ukuran maksimal 150 MB')
    if (!d.base64 && !d.content) throw new Error('File atau konten diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    let file: { name: string; mime: string; size: number; buffer: Buffer }

    if (data.content) {
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

    const result = await ingestDocument({
      ownerId,
      file,
      category: data.category,
      note: data.note,
      path: data.path,
      sourceType: data.sourceType,
      share: data.share,
      hidden: data.hidden,
      expired: data.expired,
      expiredAt: data.expiredAt,
    })
    return result
  })

export const getDocument = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')
    return {
      ...doc,
      intelligenceScore: (doc.intelligenceScore ?? null) as any,
      structureJson: (doc.structureJson ?? null) as any,
    }
  })

export const listDocuments = createServerFn({ method: 'GET' }).handler(async () => {
  const ownerId = await currentUserId()
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.ownerId, ownerId))
    .orderBy(desc(documents.createdAt))
  // jsonb columns deserialize as `unknown`; cast so the server fn result is serializable.
  return rows.map((r) => ({
    ...r,
    intelligenceScore: (r.intelligenceScore ?? null) as IntelligenceScore | null,
    structureJson: (r.structureJson ?? null) as any,
  }))
})

// Hapus dokumen: baris documents + chunks (tenant schema) + objek MinIO.
export const deleteDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')

    await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.id))
    if (doc.objectKey) {
      const ctx = await getTenantContext(ownerId)
      await deleteObject(ctx.bucket, doc.objectKey).catch(() => {})
    }
    await db.delete(documents).where(eq(documents.id, data.id))
    return { ok: true }
  })

// Update dokumen: ubah kategori atau upload ulang file.
export const updateDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as {
      id: string
      category?: string | null
      sourceType?: string
      name?: string
      mime?: string
      size?: number
      base64?: string
    }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    if (d.base64 && d.size && d.size > 150 * 1024 * 1024) throw new Error('Ukuran maksimal 150 MB')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')

    // If a new file is provided, re-ingest (delete old chunks/minio, upload new).
    if (data.base64) {
      const buffer = Buffer.from(data.base64, 'base64')
      // Remove old vector chunks
      await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.id))
      // Remove old MinIO object
      const ctx = await getTenantContext(ownerId)
      if (doc.objectKey) {
        const { deleteObject } = await import('../minio')
        await deleteObject(ctx.bucket, doc.objectKey).catch(() => {})
      }
      // Re-ingest with the same document ID
      return ingestDocument({
        ownerId,
        file: { name: data.name ?? doc.name, mime: data.mime ?? 'application/octet-stream', size: data.size ?? buffer.length, buffer },
        category: data.category !== undefined ? data.category : doc.category,
        note: doc.note ?? undefined,
        path: doc.path ?? undefined,
        sourceType: data.sourceType !== undefined ? data.sourceType : (doc.sourceType ?? 'document'),
        share: doc.share ?? 'private',
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

// Toggle sembunyikan dokumen.
export const toggleHiddenDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; hidden: boolean }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')
    await db
      .update(documents)
      .set({ hidden: data.hidden })
      .where(eq(documents.id, data.id))
    return { ok: true, hidden: data.hidden }
  })

// Proses ulang dokumen yang sudah ada (ambil file dari MinIO, re-index dgn parser terbaru).
export const reprocessDocument = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')
    if (!doc.objectKey) throw new Error('Objek file tidak tersedia')

    // Ambil file dari MinIO (via getObject)
    const { getObject } = await import('../minio')
    const ctx = await getTenantContext(ownerId)
    const fileBuf = await getObject(ctx.bucket, doc.objectKey)
    if (!fileBuf) throw new Error('File tidak ditemukan di penyimpanan')

    // Hapus chunks lama
    await getVectorStore(ownerId).then((s) => s.deleteByDocument(data.id))

    // Reset status dokumen ke processing sebelum re-ingest
    await db.update(documents).set({ status: 'processing' }).where(eq(documents.id, data.id))

    // Re-ingest dengan documentId yang sama (parser terbaru akan dipakai)
    const result = await ingestDocument({
      ownerId,
      file: { name: doc.name, mime: doc.mime ?? 'application/pdf', size: fileBuf.length, buffer: fileBuf },
      category: doc.category,
      note: doc.note ?? undefined,
      path: doc.path ?? undefined,
      sourceType: doc.sourceType ?? 'document',
      share: doc.share ?? 'private',
      hidden: doc.hidden,
      expired: !!doc.expiredAt,
      expiredAt: doc.expiredAt ? doc.expiredAt.toISOString() : null,
      documentId: data.id,
    })
    return result
  })

// URL unduh sementara (presigned) untuk dokumen.
export const downloadDocumentUrl = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')
    if (!doc.objectKey) throw new Error('Objek tidak tersedia')
    const ctx = await getTenantContext(ownerId)
    const url = await getPresignedUrl(ctx.bucket, doc.objectKey, 60 * 10)
    return { url, name: doc.name }
  })

export const getDocumentContent = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('ID dokumen diperlukan')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, data.id),
    })
    if (!doc || doc.ownerId !== ownerId) throw new Error('Dokumen tidak ditemukan')
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
