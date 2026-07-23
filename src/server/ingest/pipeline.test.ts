import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db, pool } from '../../lib/db'
import { documents, chunks } from '../../lib/schema/documents'
import { ingestDocument } from './pipeline'
import { parseDocument } from './parse'
import { chunkText } from './chunk'
import { deleteObject } from '../minio'
import { getVectorStore } from '../tenant'
import { eq } from 'drizzle-orm'

const TEST_USER = 'test-ingest-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Ingest', 'ingest-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM usage WHERE user_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM tenant_map WHERE user_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

async function ingest(text: string, opts: Partial<Parameters<typeof ingestDocument>[0]> = {}) {
  const res = await ingestDocument({
    ownerId: TEST_USER,
    file: { name: 'doc.txt', mime: 'text/plain', size: text.length, buffer: Buffer.from(text) },
    ...opts,
  })
  if (res.status === 'error') throw new Error(res.error)
  return res
}

describe('ingest pipeline (Story 1.2)', () => {
  it('parseDocument extracts plain text from .txt', async () => {
    const out = await parseDocument(Buffer.from('Halo dunia. Ini dokumen tes.'), 'text/plain', 'a.txt')
    expect(out.text).toContain('Halo dunia')
  })

  it('parseDocument extracts text from a real PDF (pdf-parse v1)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const sample = path.join('node_modules', 'pdf-parse', 'test', 'data', '01-valid.pdf')
    const buf = fs.readFileSync(sample)
    const out = await parseDocument(buf, 'application/pdf', '01-valid.pdf')
    expect(out.text.length).toBeGreaterThan(100)
    expect(out.pages ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('chunkText splits into multiple chunks with content', () => {
    const big = Array.from({ length: 200 }, (_, i) => `Kalimat nomor ${i} tentang kontrak kerja.`).join(' ')
    const parts = chunkText(big)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((c) => c.content.length > 0)).toBe(true)
  })

  it('ingestDocument stores to MinIO + indexes chunks + marks ready', async () => {
    const res = await ingest('Kontrak kerja antara A dan B. Gaji dibayar tiap bulan.', {
      category: 'Kontrak',
      path: '/arsip',
    })
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, res.documentId) })
    expect(doc?.status).toBe('ready')
    expect(doc?.category).toBe('Kontrak')
    expect(doc?.path).toBe('/arsip')
    const stored = await db.query.chunks.findMany({ where: eq(chunks.documentId, res.documentId) })
    expect(stored.length).toBeGreaterThan(0)
    expect(stored[0].embedding).toBeTruthy()
    if (doc?.objectKey) await deleteObject('docpro-person', doc.objectKey).catch(() => {})
  })
})

describe('Story 1.3 — path manual as source', () => {
  it('stores path per document and chunk is filterable by path', async () => {
    const res = await ingest('Dokumen dengan lokasi manual untuk filter.', { path: '/arsip/rahasia' })
    const store = await getVectorStore(TEST_USER)
    const byPath = await store.query(TEST_USER, await embedTest('lokasi manual'), { path: '/arsip/rahasia' })
    expect(byPath.length).toBeGreaterThan(0)
    expect(byPath.every((c) => c.path === '/arsip/rahasia')).toBe(true)
    if (res.documentId) await deleteObject('docpro-person', `person/${TEST_USER}/${res.documentId}/doc.txt`).catch(() => {})
  })
})

describe('Story 1.4 — expired/hidden excluded from retrieval', () => {
  it('excludes expired and hidden documents from query by default', async () => {
    const normal = await ingest('Dokumen aktif yang boleh muncul di pencarian.', { path: '/aktif' })
    const expired = await ingest('Dokumen kadaluarsa tidak boleh muncul.', {
      path: '/expired',
      expired: true,
      expiredAt: new Date(Date.now() - 86400000).toISOString(),
    })
    const hidden = await ingest('Dokumen disembunyikan tidak boleh muncul.', {
      path: '/hidden',
      hidden: true,
    })

    const store = await getVectorStore(TEST_USER)
    const all = await store.query(TEST_USER, await embedTest('dokumen'), { limit: 20 })
    const ids = all.map((c) => c.documentId)
    expect(ids).toContain(normal.documentId)
    expect(ids).not.toContain(expired.documentId)
    expect(ids).not.toContain(hidden.documentId)

    // include flags bypass the exclusion
    const withExpired = await store.query(TEST_USER, await embedTest('dokumen'), {
      limit: 20,
      includeExpired: true,
      includeHidden: true,
    })
    const ids2 = withExpired.map((c) => c.documentId)
    expect(ids2).toContain(expired.documentId)
    expect(ids2).toContain(hidden.documentId)

    for (const r of [normal, expired, hidden]) {
      await deleteObject('docpro-person', `person/${TEST_USER}/${r.documentId}/doc.txt`).catch(() => {})
    }
  })
})

// local embedding matching the app fallback (deterministic) for test queries
async function embedTest(text: string): Promise<number[]> {
  const { embed } = await import('../llm')
  return embed(text)
}
