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
  orgLogoUrl: string | null
  tier: string
}

export const getProfileFn = createServerFn({ method: 'GET' }).handler(async (): Promise<ProfileData> => {
  const userId = await currentUserId()
  const session = await auth.api.getSession({ headers: getRequest()?.headers })

  let tm: any = null
  try {
    tm = await db.query.tenantMap.findFirst({
      where: eq(tenantMap.userId, userId),
      columns: { orgName: true, orgLogo: true, tier: true },
    })
  } catch (error) {
    console.error('Error fetching profile from tenant_map:', error)
    // If query fails, try to ensure tenant context exists
    try {
      const { getTenantContext } = await import('../tenant')
      const ctx = await getTenantContext(userId)
      tm = { orgName: null, orgLogo: null, tier: ctx.tier }
    } catch (innerError) {
      console.error('Error ensuring tenant context:', innerError)
      // Return default values
      tm = { orgName: null, orgLogo: null, tier: 'free' }
    }
  }

  let orgLogoUrl: string | null = null
  if (tm?.orgLogo) {
    try {
      const { getTenantContext } = await import('../tenant')
      const { getPresignedUrl } = await import('../minio')
      const ctx = await getTenantContext(userId)
      orgLogoUrl = await getPresignedUrl(ctx.bucket, tm.orgLogo, 60 * 60)
    } catch (error) {
      console.error('Error building org logo URL:', error)
    }
  }

  return {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? '',
    orgName: tm?.orgName ?? null,
    orgLogoUrl,
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

const MAX_LOGO_BYTES = 3 * 1024 * 1024 // 3 MB

const LOGO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

export const updateOrgLogoFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { base64?: string; mime?: string; size?: number }
    if (!d?.base64) throw new Error('Image data is required')
    if (!d?.mime) throw new Error('Image type is required')
    if (!LOGO_EXT[d.mime]) throw new Error('Only PNG, JPEG, WEBP, GIF, SVG or AVIF images are supported')
    if (d.size != null && d.size > MAX_LOGO_BYTES) throw new Error('Maximum logo size is 3 MB')
    return { base64: d.base64, mime: d.mime }
  })
  .handler(async ({ data }): Promise<{ ok: true; orgLogoUrl: string }> => {
    const userId = await currentUserId()
    const buffer = Buffer.from(data.base64, 'base64')
    if (buffer.length === 0) throw new Error('Empty image data')
    if (buffer.length > MAX_LOGO_BYTES) throw new Error('Maximum logo size is 3 MB')

    const { getTenantContext } = await import('../tenant')
    const { putObject, getPresignedUrl } = await import('../minio')
    const ctx = await getTenantContext(userId)

    // Deterministic key so re-uploads overwrite the same object (no orphan cleanup).
    const key = `${userId}/org-logo/.${LOGO_EXT[data.mime]}`
    await putObject(ctx.bucket, key, buffer, buffer.length)

    await db.update(tenantMap).set({ orgLogo: key, updatedAt: new Date() }).where(eq(tenantMap.userId, userId))

    const orgLogoUrl = await getPresignedUrl(ctx.bucket, key, 60 * 60)
    return { ok: true, orgLogoUrl }
  })
