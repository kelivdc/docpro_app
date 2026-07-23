import { randomUUID } from 'crypto'
import { db, pool } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { getTenantContext, getVectorStore } from '../tenant'
import { putObject, objectKeyFor } from '../minio'
import { embedBatch } from '../llm'
import { getParser } from './parser-registry'
import { defaultStructureDetector } from './structure'
import { smartChunk } from './chunking'
import { scoreIntelligence, INTELLIGENCE_THRESHOLD } from './intelligence'
import { TxtParser } from './parsers'
import { eq } from 'drizzle-orm'
import type { IntelligentChunk, IntelligenceScore } from './types'

export interface IngestInput {
  ownerId: string
  file: { name: string; mime: string; size: number; buffer: Buffer }
  category?: string | null
  note?: string
  path?: string
  sourceType?: string
  share?: string
  hidden?: boolean
  expired?: boolean
  expiredAt?: string | null
  documentId?: string // re-use existing document ID for re-upload
}

export interface IngestResult {
  documentId: string
  status: 'ready' | 'error'
  chunks: number
  intelligence?: IntelligenceScore
  error?: string
}

// Some documents (especially PDFs) can embed null bytes that PostgreSQL's
// UTF-8 text columns cannot accept — strip them early.
const sanitizeText = (s: string): string => s.replace(/\0/g, '')

// Document Intelligence Pipeline:
//   Upload -> Extract Text -> Structure Detection -> Metadata -> Smart Chunking
//   -> Embedding -> Store (Vector Store strategy) -> MinIO (original kept)
// If the intelligence score is below threshold, retry with an alternative
// (fallback) parser before embedding.
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const ctx = await getTenantContext(input.ownerId)
  const isUpdate = !!input.documentId
  const documentId = input.documentId ?? randomUUID()
  const key = objectKeyFor(input.ownerId, documentId, input.file.name)

  try {
    // 1. persist original file to MinIO (never deleted)
    await putObject(ctx.bucket, key, input.file.buffer, input.file.size)

    // 2. register / update document
    const note = input.note ? sanitizeText(input.note) : null
    if (isUpdate) {
      await db
        .update(documents)
        .set({
          name: input.file.name,
          category: input.category ?? null,
          note,
          path: input.path || null,
          sourceType: input.sourceType ?? 'document',
          share: input.share ?? 'private',
          hidden: input.hidden ?? false,
          expired: input.expired ?? false,
          expiredAt: input.expiredAt ? new Date(input.expiredAt) : null,
          objectKey: key,
          sizeBytes: input.file.size,
          mime: input.file.mime,
          status: 'processing',
          intelligenceScore: null,
          structureJson: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId))
    } else {
      await db.insert(documents).values({
        id: documentId,
        ownerId: input.ownerId,
        name: input.file.name,
        category: input.category ?? null,
        note,
        path: input.path || null,
        sourceType: input.sourceType ?? 'document',
        share: input.share ?? 'private',
        hidden: input.hidden ?? false,
        expired: input.expired ?? false,
        expiredAt: input.expiredAt ? new Date(input.expiredAt) : null,
        objectKey: key,
        sizeBytes: input.file.size,
        mime: input.file.mime,
        status: 'processing',
      })
    }

    // 3. parse + structure + chunk (with fallback strategy)
    const parser = getParser(input.file.mime, input.file.name)
    let parsed = await parser.parse(input.file.buffer, input.file.name)
    parsed.text = sanitizeText(parsed.text)
    let structure = defaultStructureDetector.detect(parsed.text, { pages: parsed.pages })
    // Sanitize structure fields that end up in JSON columns.
    if (structure.title) structure.title = sanitizeText(structure.title)
    if (structure.language) structure.language = sanitizeText(structure.language)
    let intelligence = scoreIntelligence(structure, parsed)

    if (intelligence.overall < INTELLIGENCE_THRESHOLD && parser.name !== 'txt' && parser.name !== 'pdf' && parser.name !== 'image') {
      // Alternative strategy: re-extract as raw text and re-detect.
      // PDFs are excluded because PdfParser already has a pdftotext fallback internally
      // and treating the binary PDF buffer as raw UTF-8 text produces garbage.
      const fallback = new TxtParser()
      parsed = await fallback.parse(input.file.buffer, input.file.name)
      parsed.text = sanitizeText(parsed.text)
      structure = defaultStructureDetector.detect(parsed.text, { pages: parsed.pages })
      intelligence = scoreIntelligence(structure, parsed, true)
    }

    if (structure.blocks.length === 0) {
      const message =
        'Tidak ada teks yang bisa diekstrak dari dokumen ini. ' +
        'Pastikan file bukan hasil pemindaian (scan) tanpa lapisan teks, atau coba unggah versi teks.'
      await db
        .update(documents)
        .set({ status: 'error', error: message, intelligenceScore: intelligence })
        .where(eq(documents.id, documentId))
      return { documentId, status: 'error', chunks: 0, intelligence, error: message }
    }

    const base = {
      documentId,
      ownerId: input.ownerId,
      filename: input.file.name,
      language: structure.language,
      category: input.category ?? null,
      path: input.path || null,
    }
    const chunks = smartChunk(structure, base)
    // Remove null bytes from every chunk (PostgreSQL UTF-8 columns reject them).
    for (const c of chunks) c.content = sanitizeText(c.content)

    // 4. embed (after smart chunking) then store
    const vectors = await embedBatch(chunks.map((c) => c.content))
    const withEmbed: Array<IntelligentChunk & { embedding: number[] }> = chunks.map((c, i) => ({
      ...c,
      embedding: vectors[i],
    }))

    const store = await getVectorStore(input.ownerId)
    await store.upsert(withEmbed)

    // 5. mark ready + persist intelligence score + structure
    await db
      .update(documents)
      .set({
        status: 'ready',
        intelligenceScore: intelligence,
        structureJson: { title: structure.title, language: structure.language } as any,
        chunksCount: chunks.length,
      })
      .where(eq(documents.id, documentId))
    await bumpStorageUsage(input.ownerId, input.file.size)

    return {
      documentId,
      status: 'ready',
      chunks: chunks.length,
      intelligence,
    }
  } catch (err) {
    console.error('[ingest] failed:', err)
    const message = err instanceof Error ? err.message : 'Ingest gagal'
    await db
      .update(documents)
      .set({ status: 'error' })
      .where(eq(documents.id, documentId))
      .catch(() => {})
    return { documentId, status: 'error', chunks: 0, error: message }
  }
}

async function bumpStorageUsage(userId: string, addedBytes: number) {
  const date = new Date().toISOString().slice(0, 10)
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM usage WHERE user_id = $1 AND date = $2::text LIMIT 1`,
    [userId, date],
  )
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE usage SET storage_bytes = storage_bytes + $2::int, updated_at = now() WHERE id = $1`,
      [existing.rows[0].id, addedBytes],
    )
  } else {
    await pool.query(
      `INSERT INTO usage (user_id, date, storage_bytes) VALUES ($1,$2,$3::int)`,
      [userId, date, addedBytes],
    )
  }
}
