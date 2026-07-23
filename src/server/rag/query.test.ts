import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from '../../lib/db'
import { ingestDocument } from '../ingest/pipeline'
import { answerQuestion, ChatLimitError } from './query'
import { getMonthlyTokenUsage } from '../tenant'
import { deleteObject } from '../minio'

const TEST_USER = 'test-chat-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Chat', 'chat-test@docpro.local', true, now(), now())
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

describe('RAG chat (Story Chat)', () => {
  it('returns answer + sources[] from ingested document', async () => {
    const text =
      'Kebijakan cuti tahunan: setiap karyawan mendapat 12 hari cuti berbayar per tahun. ' +
      'Cuti diperuntukkan bagi karyawan tetap. Pengajuan minimal 3 hari sebelumnya.'
    const res = await ingestDocument({
      ownerId: TEST_USER,
      file: { name: 'kebijakan.txt', mime: 'text/plain', size: text.length, buffer: Buffer.from(text) },
      category: 'HR',
      path: '/hr/kebijakan',
    })
    expect(res.status).toBe('ready')

    const ans = await answerQuestion(TEST_USER, 'Berapa hari cuti tahunan karyawan?')
    expect(ans.answer.length).toBeGreaterThan(0)
    expect(ans.sources.length).toBeGreaterThan(0)
    expect(ans.sources[0].name).toBe('kebijakan.txt')
    expect(ans.sources[0].path).toBe('/hr/kebijakan')
    // answer must NOT contain the file path/source leakage (AR-13 separation)
    expect(ans.answer).not.toContain('/hr/kebijakan')
    // token usage harus ada
    expect(ans.usage?.totalTokens).toBeGreaterThan(0)
    expect(ans.usage?.promptTokens).toBeGreaterThan(0)

    if (res.documentId) {
      await deleteObject('docpro-person', `person/${TEST_USER}/${res.documentId}/kebijakan.txt`).catch(() => {})
    }
  })

  it('returns graceful message when no documents match', async () => {
    const ans = await answerQuestion(TEST_USER, 'warna langit pada malam hari adalah ungu kehitaman dan bintang berkedip')
    expect(ans.sources.length).toBe(0)
    expect(ans.answer.toLowerCase()).toContain('tidak')
    // no-answer still counts toward token usage (standalone rewrite consumes tokens)
    expect(ans.usage?.totalTokens).toBeGreaterThan(0)
  })

  it('tracks monthly token usage', async () => {
    const before = await getMonthlyTokenUsage(TEST_USER)
    await answerQuestion(TEST_USER, 'Apa isi kebijakan cuti tahunan?').catch(() => {})
    const after = await getMonthlyTokenUsage(TEST_USER)
    expect(after).toBeGreaterThan(before)
  })
})
