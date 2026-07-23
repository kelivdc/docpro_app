import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from '../../lib/db'
import { deleteObject } from '../minio'
import { ingestDocument } from './pipeline'
import { defaultStructureDetector } from './structure'
import { smartChunk } from './chunking'
import { scoreIntelligence } from './intelligence'
import { getParser } from './parser-registry'

const TEST_USER = 'test-di-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'DI', 'di@docpro.local', true, now(), now())
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

const LEGAL_DOC = `BAB IV
Pasal 24
Ayat 1 Setiap warga negara berhak atas perlindungan hukum yang setara.
Ayat 2 Ketentuan lebih lanjut diatur dengan peraturan perundang-undangan.

Pasal 25
Ayat 1 Negara menjamin kemerdekaan berserikat dan berkumpul.
`

describe('Document Intelligence Pipeline', () => {
  it('detects structure (BAB/Pasal/Ayat) from legal text', () => {
    const parser = getParser('text/plain', 'doc.txt')
    const parsed = parser.name === 'txt' ? { text: LEGAL_DOC, ocrConfidence: 1 } : null
    expect(parsed).not.toBeNull()
    const structure = defaultStructureDetector.detect(LEGAL_DOC)
    const types = structure.blocks.map((b) => b.type)
    expect(types).toContain('chapter')
    expect(types).toContain('pasal')
    expect(types).toContain('ayat')
  })

  it('groups Pasal + Ayat into a single chunk (smart chunking)', () => {
    const structure = defaultStructureDetector.detect(LEGAL_DOC)
    const chunks = smartChunk(structure, {
      documentId: 'x',
      ownerId: 'x',
      filename: 'doc.txt',
      language: structure.language,
    })
    // Pasal 24 + its 2 ayat should be one logical chunk (or tightly grouped).
    const pasalChunk = chunks.find((c) => c.content.includes('Pasal 24') && c.content.includes('Ayat 2'))
    expect(pasalChunk).toBeDefined()
    expect(pasalChunk?.headingPath).toContain('BAB IV')
    expect(pasalChunk?.totalChunks).toBeGreaterThan(0)
  })

  it('computes a Document Intelligence Score', () => {
    const structure = defaultStructureDetector.detect(LEGAL_DOC)
    const score = scoreIntelligence(structure, { text: LEGAL_DOC, ocrConfidence: 1 })
    expect(score.overall).toBeGreaterThan(0)
    expect(score.structureDetection).toBeGreaterThan(0)
    expect(score.headingDetection).toBeGreaterThan(0)
  })

  it('ingests legal doc, stores metadata + intelligence score, and groups structure', async () => {
    const res = await ingestDocument({
      ownerId: TEST_USER,
      file: { name: 'uu.txt', mime: 'text/plain', size: LEGAL_DOC.length, buffer: Buffer.from(LEGAL_DOC) },
      category: 'Legal',
    })
    expect(res.status).toBe('ready')
    expect(res.intelligence).toBeDefined()
    expect(res.intelligence?.overall).toBeGreaterThan(0)

    const rows = await pool.query<{ heading_path: string | null; content: string }>(
      `SELECT heading_path, content FROM person.chunks WHERE document_id = $1`,
      [res.documentId],
    )
    const grouped = rows.rows.find((r) => r.content.includes('Pasal 24') && r.content.includes('Ayat 2'))
    expect(grouped).toBeDefined()
    expect(grouped?.heading_path).toContain('BAB IV')

    const doc = await pool.query<{ intelligence_score: any; chunks_count: number }>(
      `SELECT intelligence_score, chunks_count FROM person.documents WHERE id = $1`,
      [res.documentId],
    )
    expect(doc.rows[0].intelligence_score).toBeTruthy()
    expect(doc.rows[0].chunks_count).toBe(rows.rows.length)

    await deleteObject('docpro-person', `person/${TEST_USER}/${res.documentId}/uu.txt`).catch(() => {})
  })
})
