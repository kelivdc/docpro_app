import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '../../lib/db'
import { tenantMap } from '../../lib/schema/tenant'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export interface ProfileData {
  name: string | null
  email: string
  orgName: string | null
  tier: string
}

export const getProfileFn = createServerFn({ method: 'GET' }).handler(async (): Promise<ProfileData> => {
  const userId = await currentUserId()
  const session = await auth.api.getSession({ headers: getRequest()?.headers })

  let tm: any = null
  try {
    tm = await db.query.tenantMap.findFirst({
      where: eq(tenantMap.userId, userId),
      columns: { orgName: true, tier: true },
    })
  } catch (error) {
    console.error('Error fetching profile from tenant_map:', error)
    // If query fails, try to ensure tenant context exists
    try {
      const { getTenantContext } = await import('../tenant')
      const ctx = await getTenantContext(userId)
      tm = { orgName: null, tier: ctx.tier }
    } catch (innerError) {
      console.error('Error ensuring tenant context:', innerError)
      // Return default values
      tm = { orgName: null, tier: 'free' }
    }
  }

  return {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? '',
    orgName: tm?.orgName ?? null,
    tier: tm?.tier ?? 'free',
  }
})

export const updateOrgNameFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { orgName?: string }
    return { orgName: d?.orgName?.trim() || null }
  })
  .handler(async ({ data }): Promise<{ ok: true; orgName: string | null }> => {
    const userId = await currentUserId()

    // First, ensure tenant_map record exists by calling getTenantContext
    try {
      const { getTenantContext } = await import('../tenant')
      await getTenantContext(userId)
    } catch (error: any) {
      console.error('Error ensuring tenant context:', error)
      throw new Error(`Failed to initialize user tenant: ${error.message}`)
    }

    // Now update the org name
    try {
      await db
        .update(tenantMap)
        .set({ orgName: data.orgName, updatedAt: new Date() })
        .where(eq(tenantMap.userId, userId))

      return { ok: true, orgName: data.orgName }
    } catch (error: any) {
      console.error('Error updating org name:', error)
      throw new Error(`Failed to update organization name: ${error.message}`)
    }
  })
