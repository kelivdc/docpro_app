import { db, pool } from '../lib/db'
import { tenantMap, usage, TIER_LIMITS, type Tier, type LlmMode } from '../lib/schema/tenant'
import { eq } from 'drizzle-orm'
import { PgVectorStore, type VectorStore } from './rag/vector-store'
import { QdrantVectorStore } from './rag/qdrant'

export interface TenantContext {
  userId: string
  email: string
  tier: Tier
  schemaName: string
  bucket: string
  llmMode: LlmMode
  orgId?: string
  limits: { storageBytes: number; tokenPerMonth: number }
}

// AD-1 / AD-11: resolve user -> isolation context.
// Creates a tenant_map row on first use (defaults to `person` schema + person bucket).
export async function getTenantContext(userId: string): Promise<TenantContext> {
  const existing = await db.query.tenantMap.findFirst({
    where: eq(tenantMap.userId, userId),
  })

  if (existing) {
    const tier = existing.tier as Tier
    return {
      userId,
      email: existing.email,
      tier,
      schemaName: existing.schemaName,
      bucket: existing.bucket,
      llmMode: existing.llmMode as LlmMode,
      orgId: existing.orgId ?? undefined,
      limits: { storageBytes: TIER_LIMITS[tier]?.storageBytes ?? TIER_LIMITS.free.storageBytes, tokenPerMonth: TIER_LIMITS[tier]?.tokenPerMonth ?? TIER_LIMITS.free.tokenPerMonth },
    }
  }

  // New user -> Free tier (shared `person` schema + person bucket).
  const email = await resolveEmail(userId)
  await db.insert(tenantMap).values({
    userId,
    email,
    tier: 'free',
    schemaName: 'person',
    bucket: 'docpro-person',
    llmMode: 'cloud',
  })

  return {
    userId,
    email,
    tier: 'free',
    schemaName: 'person',
    bucket: 'docpro-person',
    llmMode: 'cloud',
    limits: { storageBytes: TIER_LIMITS.free.storageBytes, tokenPerMonth: TIER_LIMITS.free.tokenPerMonth },
  }
}

// For Business/Enterprise upgrade: provision a dedicated schema + bucket.
export async function provisionDedicatedTenant(
  userId: string,
  slug: string,
): Promise<TenantContext> {
  const schemaName = `t_${slug.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`
  const bucket = `docpro-${slug.toLowerCase()}`
  await db
    .update(tenantMap)
    .set({ tier: 'business', schemaName, bucket, updatedAt: new Date() })
    .where(eq(tenantMap.userId, userId))
  return getTenantContext(userId)
}

async function resolveEmail(userId: string): Promise<string> {
  const row = await pool.query<{ email: string }>(
    `SELECT email FROM "user" WHERE id = $1`,
    [userId],
  )
  return row.rows[0]?.email ?? 'unknown'
}

const utcMonth = () => new Date().toISOString().slice(0, 7) // YYYY-MM

export async function incrementChatUsage(
  userId: string,
  cost?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; costIdr: number },
): Promise<void> {
  const month = utcMonth()
  const existing = await pool.query<{
    id: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cost_usd: number
    cost_idr: number
  }>(`SELECT id, prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_idr FROM usage WHERE user_id = $1 AND date = $2`, [userId, month])
  const row = existing.rows[0]
  if (row) {
    const p = cost?.promptTokens ?? 0
    const c = cost?.completionTokens ?? 0
    const t = cost?.totalTokens ?? 0
    const u = cost?.costUsd ?? 0
    const r = cost?.costIdr ?? 0
    await pool.query(
      `UPDATE usage SET chat_count = chat_count + 1, prompt_tokens = prompt_tokens + $1, completion_tokens = completion_tokens + $2, total_tokens = total_tokens + $3, cost_usd = cost_usd + $4, cost_idr = cost_idr + $5, updated_at = now() WHERE id = $6`,
      [p, c, t, u, r, row.id],
    )
  } else {
    await pool.query(
      `INSERT INTO usage (user_id, date, chat_count, prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_idr) VALUES ($1,$2,1,$3,$4,$5,$6,$7)`,
      [userId, month, cost?.promptTokens ?? 0, cost?.completionTokens ?? 0, cost?.totalTokens ?? 0, cost?.costUsd ?? 0, cost?.costIdr ?? 0],
    )
  }
}

export async function getMonthlyTokenUsage(userId: string): Promise<number> {
  const month = utcMonth()
  const row = await pool.query<{ total: number }>(
    `SELECT COALESCE(SUM(total_tokens), 0) AS total FROM usage WHERE user_id = $1 AND date = $2`,
    [userId, month],
  )
  return row.rows[0]?.total ?? 0
}

// Returns a vector store bound to the tenant's schema (AD-4).
// Uses Qdrant when QDRANT_URL is configured, otherwise pgvector.
export async function getVectorStore(userId: string): Promise<VectorStore> {
  const ctx = await getTenantContext(userId)
  const qdrantUrl = process.env.QDRANT_URL
  if (qdrantUrl) {
    return new QdrantVectorStore(
      qdrantUrl,
      ctx.schemaName,
      process.env.QDRANT_API_KEY,
    )
  }
  return new PgVectorStore(pool, ctx.schemaName)
}
