import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from '../lib/db'
import {
  getOrCreateDefaultWorkspace,
  createWorkspace,
  renameWorkspace,
  listWorkspaces,
  deleteWorkspace,
} from './workspace-service'

const TEST_USER = 'test-ws-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test WS', 'ws-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

describe('Workspace service', () => {
  it('provisions exactly one default workspace (DUPLICATE_PROVISION / AD-WS-5)', async () => {
    const a = await getOrCreateDefaultWorkspace(TEST_USER)
    const b = await getOrCreateDefaultWorkspace(TEST_USER)
    expect(a.id).toBe(b.id)
    const rows = await pool.query<{ is_default: boolean }>(
      `SELECT is_default FROM person.workspaces WHERE owner_id = $1 AND is_default = true`,
      [TEST_USER],
    )
    expect(rows.rows.length).toBe(1)
  })

  it('lists workspaces with document counts, default first', async () => {
    const def = (await getOrCreateDefaultWorkspace(TEST_USER)).id
    await createWorkspace(TEST_USER, { name: 'B Khusus' })
    await createWorkspace(TEST_USER, { name: 'A Kerja' })
    const list = await listWorkspaces(TEST_USER)
    expect(list.length).toBe(3)
    expect(list[0].id).toBe(def)
    expect(list[0].isDefault).toBe(true)
    expect(list.some((w) => w.name === 'A Kerja')).toBe(true)
    expect(list.every((w) => typeof w.documentCount === 'number')).toBe(true)
  })

  it('rejects deleting the default workspace (DEFAULT_DELETE / AD-WS-7)', async () => {
    const def = (await getOrCreateDefaultWorkspace(TEST_USER)).id
    await expect(deleteWorkspace(TEST_USER, def)).rejects.toThrow()
  })

  it('renames a workspace', async () => {
    const { id } = await createWorkspace(TEST_USER, { name: 'Rename Me' })
    await renameWorkspace(TEST_USER, id, 'Renamed')
    const list = await listWorkspaces(TEST_USER)
    expect(list.find((w) => w.id === id)?.name).toBe('Renamed')
    await deleteWorkspace(TEST_USER, id)
  })

  it('deletes a non-default workspace with cascade', async () => {
    const def = (await getOrCreateDefaultWorkspace(TEST_USER)).id
    void def
    const { id } = await createWorkspace(TEST_USER, { name: 'Cascade Me' })
    await pool.query(
      `INSERT INTO person.documents (id, owner_id, workspace_id, name, object_key, status)
       VALUES ('wsdel-1', $1, $2, 'doc.txt', 'obj/wsdel-1', 'ready')`,
      [TEST_USER, id],
    )
    await pool.query(
      `INSERT INTO person.categories (id, owner_id, workspace_id, name)
       VALUES ('wsdel-cat', $1, $2, 'Cat')`,
      [TEST_USER, id],
    )

    await deleteWorkspace(TEST_USER, id)

    const docs = await pool.query(`SELECT * FROM person.documents WHERE workspace_id = $1`, [id])
    expect(docs.rows.length).toBe(0)
    const cats = await pool.query(`SELECT * FROM person.categories WHERE workspace_id = $1`, [id])
    expect(cats.rows.length).toBe(0)
    const ws = await pool.query(`SELECT * FROM person.workspaces WHERE id = $1`, [id])
    expect(ws.rows.length).toBe(0)
  })

  it('blocks deleting a workspace that still has processing documents', async () => {
    const { id } = await createWorkspace(TEST_USER, { name: 'Busy' })
    await pool.query(
      `INSERT INTO person.documents (id, owner_id, workspace_id, name, object_key, status)
       VALUES ('wsdel-2', $1, $2, 'busy.txt', 'obj/wsdel-2', 'processing')`,
      [TEST_USER, id],
    )
    await expect(deleteWorkspace(TEST_USER, id)).rejects.toThrow()
    await pool.query(`DELETE FROM person.documents WHERE id = 'wsdel-2'`)
    await deleteWorkspace(TEST_USER, id)
  })

  it('decrements usage.storage_bytes when deleting a workspace (AD-WS-7)', async () => {
    const day = new Date().toISOString().slice(0, 10)
    await pool.query(
      `INSERT INTO usage (user_id, date, storage_bytes) VALUES ($1, $2, 5000)`,
      [TEST_USER, day],
    )
    const { id } = await createWorkspace(TEST_USER, { name: 'Storage Refund' })
    await pool.query(
      `INSERT INTO person.documents (id, owner_id, workspace_id, name, object_key, status, size_bytes)
       VALUES ('wsdel-storage', $1, $2, 'big.txt', 'obj/big', 'ready', 3000)`,
      [TEST_USER, id],
    )

    await deleteWorkspace(TEST_USER, id)

    const usage = await pool.query<{ storage_bytes: number }>(
      `SELECT storage_bytes FROM usage WHERE user_id = $1 AND date = $2`,
      [TEST_USER, day],
    )
    expect(usage.rows[0]?.storage_bytes).toBe(2000)
  })
})
