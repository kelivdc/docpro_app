import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from '../../lib/db'
import { purgeAccountData } from '../account-purge'
import { getOrCreateDefaultWorkspace, createWorkspace } from '../workspace-service'

const TEST_USER = 'test-purge-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Purge', 'purge-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM person.chunks WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM tenant_map WHERE user_id = $1`, [TEST_USER])
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.chunks WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM tenant_map WHERE user_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

describe('purgeDeletedAccounts (AD-WS-7)', () => {
  it('cleans workspace rows + documents + chunks when purging a deleted account', async () => {
    const docId = crypto.randomUUID()
    await getOrCreateDefaultWorkspace(TEST_USER)
    const extra = (await createWorkspace(TEST_USER, { name: 'Purge Me' })).id
    await pool.query(
      `INSERT INTO person.documents (id, owner_id, workspace_id, name, object_key, status)
       VALUES ($1, $2, $3, 'doc.txt', 'obj/purge-1', 'ready')`,
      [docId, TEST_USER, extra],
    )
    await pool.query(
      `INSERT INTO person.chunks (id, document_id, owner_id, workspace_id, content)
       VALUES ('purge-c1', $1, $2, $3, 'chunk')`,
      [docId, TEST_USER, extra],
    )
    await pool.query(
      `INSERT INTO tenant_map (user_id, email, schema_name, tier, deleted_at, created_at, updated_at)
       VALUES ($1, 'purge-test@docpro.local', 'person', 'free', now() - interval '8 days', now(), now())
       ON CONFLICT (user_id) DO NOTHING`,
      [TEST_USER],
    )

    await purgeAccountData(TEST_USER, 'person')

    const ws = await pool.query(`SELECT * FROM person.workspaces WHERE owner_id = $1`, [TEST_USER])
    expect(ws.rows.length).toBe(0)
    const docs = await pool.query(`SELECT * FROM person.documents WHERE owner_id = $1`, [TEST_USER])
    expect(docs.rows.length).toBe(0)
    const chunks = await pool.query(`SELECT * FROM person.chunks WHERE owner_id = $1`, [TEST_USER])
    expect(chunks.rows.length).toBe(0)
  })
})
