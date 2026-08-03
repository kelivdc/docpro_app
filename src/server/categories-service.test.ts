import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db, pool } from '../lib/db'
import { documents } from '../lib/schema/documents'
import { getCategories, addCategory, removeCategory, categoryExists } from './categories-service'
import { getOrCreateDefaultWorkspace, createWorkspace } from './workspace-service'

const TEST_USER = 'test-cat-user-1'

let wsId: string
let wsId2: string

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Cat', 'cat-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER])
  wsId = (await getOrCreateDefaultWorkspace(TEST_USER)).id
  wsId2 = (await createWorkspace(TEST_USER, { name: 'WS2' })).id
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

describe('Categories service', () => {
  it('adds a category and lists with 0 count', async () => {
    const { id } = await addCategory(TEST_USER, wsId, { name: 'Kontrak', description: 'Perjanjian', icon: '📄' })
    const res = await getCategories(TEST_USER, wsId)
    expect(res.categories.length).toBe(1)
    expect(res.categories[0].name).toBe('Kontrak')
    expect(res.categories[0].count).toBe(0)
    await removeCategory(TEST_USER, wsId, id)
  })

  it('counts documents grouped by category', async () => {
    const { id } = await addCategory(TEST_USER, wsId, { name: 'HR' })
    await db.insert(documents).values([
      { id: 'd1', ownerId: TEST_USER, workspaceId: wsId, name: 'a.txt', category: 'HR', objectKey: 'k', status: 'ready' },
      { id: 'd2', ownerId: TEST_USER, workspaceId: wsId, name: 'b.txt', category: 'HR', objectKey: 'k', status: 'ready' },
      { id: 'd3', ownerId: TEST_USER, workspaceId: wsId, name: 'c.txt', objectKey: 'k', status: 'ready' },
    ])
    const res = await getCategories(TEST_USER, wsId)
    const hr = res.categories.find((c) => c.name === 'HR')
    expect(hr?.count).toBe(2)
    expect(res.uncategorized).toBe(1)
    await removeCategory(TEST_USER, wsId, id)
    await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
  })

  it('allows the same category name in different workspaces (unique per workspace)', async () => {
    const a = await addCategory(TEST_USER, wsId, { name: 'Legal' })
    const b = await addCategory(TEST_USER, wsId2, { name: 'Legal' })
    const resA = await getCategories(TEST_USER, wsId)
    const resB = await getCategories(TEST_USER, wsId2)
    expect(resA.categories.some((c) => c.name === 'Legal')).toBe(true)
    expect(resB.categories.some((c) => c.name === 'Legal')).toBe(true)
    await removeCategory(TEST_USER, wsId, a.id)
    await removeCategory(TEST_USER, wsId2, b.id)
  })

  it('rejects duplicate category name in the same workspace (unique)', async () => {
    const { id } = await addCategory(TEST_USER, wsId, { name: 'Finance' })
    await expect(addCategory(TEST_USER, wsId, { name: 'Finance' })).rejects.toThrow()
    await removeCategory(TEST_USER, wsId, id)
  })

  it('categoryExists is scoped to the same workspace (AD-WS-9)', async () => {
    const { id } = await addCategory(TEST_USER, wsId, { name: 'Hukum' })
    expect(await categoryExists(TEST_USER, wsId, 'Hukum')).toBe(true)
    expect(await categoryExists(TEST_USER, wsId2, 'Hukum')).toBe(false)
    await removeCategory(TEST_USER, wsId, id)
  })

  it('removing a category recomputes documents.category to NULL (AD-WS-9)', async () => {
    const { id } = await addCategory(TEST_USER, wsId, { name: 'Operasional' })
    await db.insert(documents).values([
      { id: 'adws9-d1', ownerId: TEST_USER, workspaceId: wsId, name: 'a.txt', category: 'Operasional', objectKey: 'k', status: 'ready' },
      { id: 'adws9-d2', ownerId: TEST_USER, workspaceId: wsId2, name: 'b.txt', category: 'Operasional', objectKey: 'k', status: 'ready' },
    ])

    await removeCategory(TEST_USER, wsId, id)

    const inWs = await pool.query<{ category: string | null }>(
      `SELECT category FROM person.documents WHERE id = 'adws9-d1'`,
    )
    expect(inWs.rows[0]?.category).toBeNull()
    // doc in ANOTHER workspace with the same category name must be untouched
    const otherWs = await pool.query<{ category: string | null }>(
      `SELECT category FROM person.documents WHERE id = 'adws9-d2'`,
    )
    expect(otherWs.rows[0]?.category).toBe('Operasional')

    await pool.query(`DELETE FROM person.documents WHERE id IN ('adws9-d1','adws9-d2')`)
  })
})
