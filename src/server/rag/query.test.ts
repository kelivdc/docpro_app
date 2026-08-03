import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from '../../lib/db'
import { ingestDocument } from '../ingest/pipeline'
import { answerQuestion } from './query'
import { getMonthlyTokenUsage } from '../tenant'
import { deleteObject } from '../minio'
import { getOrCreateDefaultWorkspace, createWorkspace } from '../workspace-service'

const TEST_USER = 'test-chat-user-1'

let wsId: string
let wsId2: string

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Chat', 'chat-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER])
  wsId = (await getOrCreateDefaultWorkspace(TEST_USER)).id
  wsId2 = (await createWorkspace(TEST_USER, { name: 'WS2' })).id
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
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
      workspaceId: wsId,
      file: { name: 'kebijakan.txt', mime: 'text/plain', size: text.length, buffer: Buffer.from(text) },
      category: 'HR',
      path: '/hr/kebijakan',
    })
    expect(res.status).toBe('ready')

    const ans = await answerQuestion(TEST_USER, 'Berapa hari cuti tahunan karyawan?', { workspaceId: wsId })
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

  it('does NOT leak chunks across workspaces (QUERY_LEAK / AD-WS-4)', async () => {
    const textA =
      'Kebijakan cuti tahunan: setiap karyawan mendapat 12 hari cuti berbayar per tahun. ' +
      'Cuti diperuntukkan bagi karyawan tetap. Pengajuan minimal 3 hari sebelumnya.'
    const resA = await ingestDocument({
      ownerId: TEST_USER,
      workspaceId: wsId,
      file: { name: 'ws-a.txt', mime: 'text/plain', size: textA.length, buffer: Buffer.from(textA) },
      category: 'HR',
    })
    expect(resA.status).toBe('ready')

    // Workspace B has a DIFFERENT policy — asking about it on workspace A must
    // return zero hits from workspace B.
    const textB =
      'Kebijakan cuti tahunan: setiap karyawan mendapat 30 hari cuti berbayar per tahun. ' +
      'Cuti hanya untuk karyawan kontrak. Pengajuan minimal 1 hari sebelumnya.'
    const resB = await ingestDocument({
      ownerId: TEST_USER,
      workspaceId: wsId2,
      file: { name: 'ws-b.txt', mime: 'text/plain', size: textB.length, buffer: Buffer.from(textB) },
      category: 'HR',
    })
    expect(resB.status).toBe('ready')

    // Ask about workspace B's distinguishing policy while scoped to workspace A.
    // Retrieval is filtered by workspaceId (base + expansion), so no wsB chunk
    // can appear; similarity is judged only against wsA content.
    const ans = await answerQuestion(TEST_USER, 'Berapa hari cuti karyawan kontrak?', { workspaceId: wsId })
    for (const s of ans.sources) {
      expect(s.name).not.toBe('ws-b.txt')
    }
  })

  it('returns graceful message when no documents match', async () => {
    const ans = await answerQuestion(TEST_USER, 'warna langit pada malam hari adalah ungu kehitaman dan bintang berkedip', { workspaceId: wsId })
    expect(ans.sources.length).toBe(0)
    expect(ans.answer.toLowerCase()).toContain('could not find')
  })

  it('tracks monthly token usage', async () => {
    const before = await getMonthlyTokenUsage(TEST_USER)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await answerQuestion(TEST_USER, 'Berapa hari cuti tahunan karyawan?', { workspaceId: wsId })
        break
      } catch (e) {
        if (attempt === 2) throw e
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    const after = await getMonthlyTokenUsage(TEST_USER)
    expect(after).toBeGreaterThan(before)
  })
})
