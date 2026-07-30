// Backfill null embeddings for existing chunks.
// Run: export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/backfill-embeddings.ts

import 'dotenv/config'
import { pool } from '../src/lib/db'
import { embedBatch } from '../src/server/llm'

const BATCH_SIZE = 32

function vec(arr: number[]): string {
  return `[${arr.join(',')}]`
}

async function main() {
  console.log('[backfill] checking for chunks with null embeddings...')

  const { rows: pending } = await pool.query<{ id: string; content: string }>(
    `SELECT id, content FROM person.chunks WHERE embedding IS NULL ORDER BY id`,
  )

  if (pending.length === 0) {
    console.log('[backfill] no chunks need backfill')
    await pool.end()
    return
  }

  console.log(`[backfill] ${pending.length} chunks need embeddings`)

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    const contents = batch.map((c) => c.content)
    const ids = batch.map((c) => c.id)

    console.log(`[backfill] processing ${i + 1}-${Math.min(i + BATCH_SIZE, pending.length)}...`)
    const vectors = await embedBatch(contents)

    if (vectors.length !== contents.length || vectors.some((v) => !Array.isArray(v) || v.length === 0)) {
      throw new Error(`Embedding failed for batch starting at ${i}: got ${vectors.length}/${contents.length} vectors`)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (let j = 0; j < batch.length; j++) {
        await client.query(
          `UPDATE person.chunks SET embedding = $1::vector WHERE id = $2`,
          [vec(vectors[j]), ids[j]],
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  console.log('[backfill] done')
  await pool.end()
}

main().catch((err) => {
  console.error('[backfill] failed:', err)
  process.exit(1)
})
