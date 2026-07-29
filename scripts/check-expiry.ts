import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db } from '../src/lib/db'
import { subscriptions, tenantMap } from '../src/lib/schema/tenant'
import { eq, and, lt } from 'drizzle-orm'
import { freezeTopups } from '../src/server/tenant'

async function main() {
  const now = new Date()

  const expired = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'active'), lt(subscriptions.expiresAt, now)))

  for (const sub of expired) {
    console.log(`[expiry] Expiring subscription ${sub.id} for user ${sub.userId}`)

    await db
      .update(subscriptions)
      .set({ status: 'expired' })
      .where(eq(subscriptions.id, sub.id))

    await db
      .update(tenantMap)
      .set({ tier: 'free', updatedAt: now })
      .where(eq(tenantMap.userId, sub.userId))

    await freezeTopups(sub.userId)

    console.log(`[expiry] User ${sub.userId} downgraded to free, top-ups frozen`)
  }

  if (expired.length === 0) {
    console.log('[expiry] No expired subscriptions found')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('[expiry] Error:', e)
  process.exit(1)
})
