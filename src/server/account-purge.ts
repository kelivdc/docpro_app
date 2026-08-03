import { db, pool } from '../lib/db'
import { tenantMap } from '../lib/schema/tenant'
import { eq } from 'drizzle-orm'
import { deleteObject } from './minio'

// AD-WS-7: full cascade for a purged account — vector-store points (pgvector or
// Qdrant), MinIO objects, DB rows (workspaces/documents/categories/chunks),
// dedicated schema drop, chat sessions, usage, then mark purged.
export async function purgeAccountData(userId: string, schemaName: string): Promise<void> {
  const tm = await pool.query<{ bucket: string }>(
    `SELECT bucket FROM tenant_map WHERE user_id = $1`,
    [userId],
  )
  const bucket = tm.rows[0]?.bucket ?? 'docpro-person'

  const workspaceIds = await pool.query<{ id: string }>(
    `SELECT id FROM person.workspaces WHERE owner_id = $1`,
    [userId],
  )
  const qdrantUrl = process.env.QDRANT_URL
  try {
    if (qdrantUrl) {
      const { QdrantVectorStore } = await import('./rag/qdrant')
      const store = new QdrantVectorStore(qdrantUrl, schemaName, process.env.QDRANT_API_KEY)
      for (const w of workspaceIds.rows) {
        await store.deleteByWorkspace(w.id)
      }
    } else {
      const { PgVectorStore } = await import('./rag/vector-store')
      const store = new PgVectorStore(pool, schemaName)
      for (const w of workspaceIds.rows) {
        await store.deleteByWorkspace(w.id)
      }
    }
  } catch (e) {
    console.error('[purge] vector-store cleanup failed for', userId, e)
  }

  const docs = await pool.query<{ objectKey: string | null }>(
    `SELECT object_key FROM person.documents WHERE owner_id = $1`,
    [userId],
  )
  for (const d of docs.rows) {
    if (d.objectKey) await deleteObject(bucket, d.objectKey).catch(() => {})
  }

  await pool.query(`DELETE FROM person.chunks WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.workspaces WHERE owner_id = $1`, [userId])

  if (schemaName !== 'person') {
    const safe = schemaName.replace(/[^a-z0-9_]/gi, '')
    await pool.query(`DROP SCHEMA IF EXISTS "${safe}" CASCADE`)
  }

  await pool.query(`DELETE FROM chat_sessions WHERE user_id = $1`, [userId])
  await pool.query(`DELETE FROM usage WHERE user_id = $1`, [userId])

  await db
    .update(tenantMap)
    .set({ purgedAt: new Date() })
    .where(eq(tenantMap.userId, userId))
}
