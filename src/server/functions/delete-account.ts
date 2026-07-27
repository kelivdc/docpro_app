import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { db, pool } from '../../lib/db'
import { tenantMap } from '../../lib/schema/tenant'
import { eq, lt } from 'drizzle-orm'

async function currentUserId(): Promise<string> {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) throw new Error('Unauthorized')
  return session.user.id
}

export const deleteAccount = createServerFn({ method: 'POST' }).handler(async () => {
  const userId = await currentUserId()

  await db
    .update(tenantMap)
    .set({ deletedAt: new Date() })
    .where(eq(tenantMap.userId, userId))

  return { success: true }
})

export const cancelDeleteAccount = createServerFn({ method: 'POST' }).handler(async () => {
  const userId = await currentUserId()

  await db
    .update(tenantMap)
    .set({ deletedAt: null })
    .where(eq(tenantMap.userId, userId))

  return { success: true }
})

export const checkAccountBlocked = createServerFn({ method: 'GET' }).handler(async () => {
  const req = getRequest()
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return { blocked: false }

  const [row] = await db
    .select({ deletedAt: tenantMap.deletedAt, purgedAt: tenantMap.purgedAt })
    .from(tenantMap)
    .where(eq(tenantMap.userId, session.user.id))
    .limit(1)

  if (row?.purgedAt) {
    await auth.api.signOut({ headers: req.headers })
    return { blocked: 'hard' }
  }

  if (row?.deletedAt) {
    await auth.api.signOut({ headers: req.headers })
    return { blocked: 'soft' }
  }

  return { blocked: false }
})

export const purgeDeletedAccounts = createServerFn({ method: 'POST' }).handler(async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const pending = await db
    .select({ userId: tenantMap.userId, schemaName: tenantMap.schemaName })
    .from(tenantMap)
    .where(lt(tenantMap.deletedAt, sevenDaysAgo))

  for (const row of pending) {
    const { userId, schemaName } = row

    await pool.query(`DELETE FROM person.chunks WHERE owner_id = $1`, [userId])
    await pool.query(`DELETE FROM person.documents WHERE owner_id = $1`, [userId])
    await pool.query(`DELETE FROM person.categories WHERE owner_id = $1`, [userId])

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

  return { purged: pending.length }
})
