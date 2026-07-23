import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db, pool } from '../lib/db'
import { documents } from '../lib/schema/documents'
import { getCategories, addCategory, removeCategory } from './categories-service'

const TEST_USER = 'test-cat-user-1'

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
     VALUES ($1, 'Test Cat', 'cat-test@docpro.local', true, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER],
  )
  await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [TEST_USER])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
})

afterAll(async () => {
  await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER]).catch(() => {})
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [TEST_USER]).catch(() => {})
  await pool.end().catch(() => {})
})

describe('Categories service', () => {
  it('adds a category and lists with 0 count', async () => {
    const { id } = await addCategory(TEST_USER, { name: 'Kontrak', description: 'Perjanjian', icon: '📄' })
    const res = await getCategories(TEST_USER)
    expect(res.categories.length).toBe(1)
    expect(res.categories[0].name).toBe('Kontrak')
    expect(res.categories[0].count).toBe(0)
    await removeCategory(TEST_USER, id)
  })

  it('counts documents grouped by category', async () => {
    const { id } = await addCategory(TEST_USER, { name: 'HR' })
    await db.insert(documents).values([
      { id: 'd1', ownerId: TEST_USER, name: 'a.txt', category: 'HR', objectKey: 'k', status: 'ready' },
      { id: 'd2', ownerId: TEST_USER, name: 'b.txt', category: 'HR', objectKey: 'k', status: 'ready' },
      { id: 'd3', ownerId: TEST_USER, name: 'c.txt', objectKey: 'k', status: 'ready' },
    ])
    const res = await getCategories(TEST_USER)
    const hr = res.categories.find((c) => c.name === 'HR')
    expect(hr?.count).toBe(2)
    expect(res.uncategorized).toBe(1)
    await removeCategory(TEST_USER, id)
    await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [TEST_USER])
  })

  it('rejects duplicate category name (unique)', async () => {
    const { id } = await addCategory(TEST_USER, { name: 'Legal' })
    await expect(addCategory(TEST_USER, { name: 'Legal' })).rejects.toThrow()
    await removeCategory(TEST_USER, id)
  })
})
