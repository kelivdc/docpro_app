import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { pool } from '../../lib/db'
import { getTenantContext } from '../tenant'

async function currentUserId(): Promise<string> {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) throw new Error('Unauthorized')
  return session.user.id
}

export const deleteAccount = createServerFn({ method: 'POST' }).handler(async () => {
  const userId = await currentUserId()
  const ctx = await getTenantContext(userId)

  // Delete from person schema tables (covers Free/Personal users)
  await pool.query(`DELETE FROM person.share_links WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.chunks WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [userId])
  await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [userId])

  // If Business/Enterprise with dedicated schema, drop it entirely
  if (ctx.schemaName !== 'person') {
    const safe = ctx.schemaName.replace(/[^a-z0-9_]/gi, '')
    await pool.query(`DROP SCHEMA IF EXISTS "${safe}" CASCADE`)
  }

  // Delete chat sessions (cascades to chat messages)
  await pool.query(`DELETE FROM chat_sessions WHERE user_id = $1`, [userId])

  // Delete user — cascades to session, account, tenant_map, usage
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId])

  return { success: true }
})
