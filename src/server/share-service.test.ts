import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db, pool } from '../lib/db'
import { documents } from '../lib/schema/documents'
import { eq } from 'drizzle-orm'
import { listShares, createShare, revokeShare, getSharedDocument } from './share-service'

const TEST_USER = 'test-share-user-1'
let docId = ''

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Share', 'share-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.share_links WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
  const id = 'doc-share-1'
  await db.insert(documents).values({
    id,
    ownerId: TEST_USER,
    name: 'kontrak-bersama.txt',
    objectKey: 'k',
    status: 'ready',
  })
  docId = id
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.share_links WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

beforeEach(async () => {
  await pool.query(`DELETE FROM person.share_links WHERE owner_id = $1`, [TEST_USER])
})

describe('Share service (Story Share RBAC)', () => {
  it('creates a share link and lists it', async () => {
    const { token } = await createShare(TEST_USER, { documentId: docId, mode: 'public' })
    expect(token.length).toBeGreaterThan(0)
    const list = await listShares(TEST_USER)
    expect(list.length).toBe(1)
    expect(list[0].documentName).toBe('kontrak-bersama.txt')
  })

  it('public token resolves the shared document metadata', async () => {
    const { token } = await createShare(TEST_USER, { documentId: docId, mode: 'public' })
    const doc = await getSharedDocument(token)
    expect(doc).not.toBeNull()
    expect(doc?.name).toBe('kontrak-bersama.txt')
  })

  it('hidden/expired document is not shared', async () => {
    const { token } = await createShare(TEST_USER, { documentId: docId })
    await db.update(documents).set({ hidden: true }).where(eq(documents.id, docId))
    const doc = await getSharedDocument(token)
    expect(doc).toBeNull()
    await db.update(documents).set({ hidden: false }).where(eq(documents.id, docId))
  })

  it('revoke removes the link', async () => {
    await createShare(TEST_USER, { documentId: docId, mode: 'public' })
    const list = await listShares(TEST_USER)
    expect(list.length).toBe(1)
    await revokeShare(TEST_USER, list[0].id)
    const after = await listShares(TEST_USER)
    expect(after.length).toBe(0)
  })
})
