import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { db } from '../../lib/db'
import { tenantMap, subscriptions, topupTokens } from '../../lib/schema/tenant'
import { price } from '../../lib/schema/price'
import { eq, sql, and, asc, desc } from 'drizzle-orm'
import { getTenantContext } from '../tenant'

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
  custom: 4,
}

function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0
}

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export interface SubscriptionStatus {
  active: boolean
  tier: string | null
  expiresAt: string | null
  topupBalance: number
  topupUsed: number
}

export const TOPUP_PACKAGES = [
  { tokens: 10_000_000, price: 9 },
  { tokens: 25_000_000, price: 19 },
  { tokens: 50_000_000, price: 35 },
  { tokens: 100_000_000, price: 65 },
] as const

export interface PriceCatalog {
  plans: PricePlan[]
  topups: PriceTopup[]
}

export interface PricePlan {
  id: string
  name: string
  tier: string
  price: number
  currency: string
  features: string[]
  note: string | null
  highlighted: boolean
}

export interface PriceTopup {
  id: string
  name: string
  tokens: number
  price: number
  currency: string
  note: string | null
}

export const getPriceCatalog = createServerFn({ method: 'GET' }).handler(async (): Promise<PriceCatalog> => {
  const rows = await db
    .select()
    .from(price)
    .where(eq(price.status, 'active'))
    .orderBy(asc(price.sortOrder))

  const plans: PricePlan[] = rows
    .filter((r) => r.type === 'plan')
    .map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier ?? '',
      price: Number(r.price),
      currency: r.currency,
      features: Array.isArray(r.features) ? (r.features as string[]) : [],
      note: r.note,
      highlighted: r.highlighted,
    }))

  const topups: PriceTopup[] = rows
    .filter((r) => r.type === 'topup')
    .map((r) => ({
      id: r.id,
      name: r.name,
      tokens: Number(r.tokens ?? 0),
      price: Number(r.price),
      currency: r.currency,
      note: r.note,
    }))

  return { plans, topups }
})

export const getSubscriptionStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<SubscriptionStatus> => {
  const userId = await currentUserId()

  const activeSub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    orderBy: [desc(subscriptions.createdAt)],
  })

  const topupRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${topupTokens.amount}), 0)` })
    .from(topupTokens)
    .where(and(eq(topupTokens.userId, userId), eq(topupTokens.status, 'active')))
  const topupTotal = topupRows[0]?.total ?? 0

  const tm = await db.query.tenantMap.findFirst({ where: eq(tenantMap.userId, userId) })

  return {
    active: !!activeSub,
    tier: activeSub?.tier ?? null,
    expiresAt: activeSub?.expiresAt?.toISOString() ?? null,
    topupBalance: topupTotal - (tm?.topupUsed ?? 0),
    topupUsed: tm?.topupUsed ?? 0,
  }
})

export const purchaseSubscription = createServerFn({ method: 'POST' })
  .validator((data: { tier: string }) => data)
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const now = new Date()

    const activeSub = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
      orderBy: [desc(subscriptions.createdAt)],
    })

    if (activeSub && activeSub.expiresAt > now) {
      if (tierRank(data.tier) < tierRank(activeSub.tier)) {
        throw new Error(
          `Cannot downgrade from ${activeSub.tier} to ${data.tier} before your current plan expires on ${activeSub.expiresAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}.`
        )
      }
    }

    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await db.insert(subscriptions).values({
      userId,
      tier: data.tier,
      startedAt: now,
      expiresAt,
      status: 'active',
    })

    await db
      .update(tenantMap)
      .set({ tier: data.tier as any, updatedAt: now })
      .where(eq(tenantMap.userId, userId))

    await unfreezeTopups(userId)

    return { expiresAt: expiresAt.toISOString() }
  })

export const purchaseTopup = createServerFn({ method: 'POST' })
  .validator((data: { tokens: number; price: number }) => data)
  .handler(async ({ data }) => {
    const userId = await currentUserId()
    const ctx = await getTenantContext(userId)

    if (ctx.tier === 'free') {
      throw new Error('Top-up only available for Pro and Business plans.')
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await db.insert(topupTokens).values({
      userId,
      amount: data.tokens,
      purchasePrice: data.price,
      purchasedAt: now,
      expiresAt,
      status: 'active',
    })

    return { expiresAt: expiresAt.toISOString() }
  })

async function unfreezeTopups(userId: string) {
  await db
    .update(topupTokens)
    .set({ status: 'active' })
    .where(and(eq(topupTokens.userId, userId), eq(topupTokens.status, 'frozen')))
}
