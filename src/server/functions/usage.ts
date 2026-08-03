import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { getTenantContext, getMonthlyTokenUsage } from '../tenant'
import { getOrCreateDefaultWorkspace } from '../workspace-service'
import { db } from '../../lib/db'
import { documents } from '../../lib/schema/documents'
import { chatSessions } from '../../lib/schema/chat'
import { topupTokens, tenantMap } from '../../lib/schema/tenant'
import { eq, sql, desc, and, gte } from 'drizzle-orm'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export interface RecentDoc {
  id: string
  name: string
  status: string
  sourceType: string | null
  createdAt: string
}

export interface ChatTrendDay {
  date: string
  label: string
  count: number
}

export interface DashboardUsage {
  tier: string
  storageUsedMb: number
  storageTotalMb: number
  storagePct: number
  tokenUsed: number
  tokenTotal: number
  tokenPct: number
  topupTotal: number
  topupUsed: number
  documentCount: number
  chatCount: number
  recentDocuments: RecentDoc[]
  chatTrend: ChatTrendDay[]
  deletionScheduled: boolean
}

export const getDashboardUsage = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { workspaceId?: string }
    return { workspaceId: d?.workspaceId }
  })
  .handler(async ({ data }): Promise<DashboardUsage> => {
    const userId = await currentUserId()
    const ctx = await getTenantContext(userId)
    const workspaceId = data.workspaceId ?? (await getOrCreateDefaultWorkspace(userId)).id

    // Storage: sum of sizeBytes from user's documents in this workspace
    const sum = await db
      .select({ total: sql<number>`COALESCE(SUM(${documents.sizeBytes}), 0)` })
      .from(documents)
      .where(and(eq(documents.ownerId, userId), eq(documents.workspaceId, workspaceId)))
    const storageUsedBytes = sum[0]?.total ?? 0

    // Token usage
    const tokenUsed = await getMonthlyTokenUsage(userId)

    // Document count
    const docCountRow = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(documents)
      .where(and(eq(documents.ownerId, userId), eq(documents.workspaceId, workspaceId)))
    const documentCount = Number(docCountRow[0]?.count ?? 0)

    // Chat session count (last 30 days), scoped to workspace
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const chatCountRow = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.workspaceId, workspaceId),
          gte(chatSessions.createdAt, thirtyDaysAgo),
        ),
      )
    const chatCount = Number(chatCountRow[0]?.count ?? 0)

    // Recent documents (last 5, scoped to workspace)
    const recentRows = await db
      .select({
        id: documents.id,
        name: documents.name,
        status: documents.status,
        sourceType: documents.sourceType,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.ownerId, userId), eq(documents.workspaceId, workspaceId)))
      .orderBy(desc(documents.createdAt))
      .limit(5)
  const recentDocuments: RecentDoc[] = recentRows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    sourceType: r.sourceType,
    createdAt: r.createdAt.toISOString(),
  }))

  // Chat trend: daily counts for last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const trendRows = await db
    .select({
      date: sql<string>`DATE(${chatSessions.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.workspaceId, workspaceId),
        gte(chatSessions.createdAt, sevenDaysAgo),
      ),
    )
    .groupBy(sql`DATE(${chatSessions.createdAt})`)

  const trendMap = new Map<string, number>()
  for (const r of trendRows) {
    trendMap.set(r.date, Number(r.count))
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const chatTrend: ChatTrendDay[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dateStr = d.toISOString().slice(0, 10)
    const label = dayLabels[d.getDay()]
    chatTrend.push({ date: dateStr, label, count: trendMap.get(dateStr) ?? 0 })
  }

  // Top-up token data
  const topupRow = await db
    .select({ total: sql<number>`COALESCE(SUM(${topupTokens.amount}), 0)` })
    .from(topupTokens)
    .where(and(eq(topupTokens.userId, userId), eq(topupTokens.status, 'active')))
  const topupTotal = topupRow[0]?.total ?? 0
  
  let topupUsed = 0
  try {
    const tm = await db.query.tenantMap.findFirst({
      where: eq(tenantMap.userId, userId),
      columns: { topupUsed: true },
    })
    topupUsed = tm?.topupUsed ?? 0
  } catch (error) {
    console.error('Error fetching topup_used from tenant_map:', error)
    // If tenant_map doesn't exist yet, the context creation should have handled it
    // But we'll fallback to 0 just in case
    topupUsed = 0
  }

  // Calculations
  const storageTotalMb = Math.round(ctx.limits.storageBytes / (1024 * 1024))
  const storageUsedMb = Math.round(storageUsedBytes / (1024 * 1024))
  const storagePct = Math.min(100, Math.round((storageUsedBytes / ctx.limits.storageBytes) * 100))
  const tokenPct = Math.min(100, Math.round((tokenUsed / ctx.limits.tokenPerMonth) * 100))

  return {
    tier: ctx.tier,
    storageUsedMb,
    storageTotalMb,
    storagePct,
    tokenUsed,
    tokenTotal: ctx.limits.tokenPerMonth,
    tokenPct,
    topupTotal,
    topupUsed,
    documentCount,
    chatCount,
    recentDocuments,
    chatTrend,
    deletionScheduled: !!ctx.deletedAt,
  }
})
