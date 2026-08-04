import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import {
  getCategories,
  addCategory,
  removeCategory,
  type CategoryView,
} from '../categories-service'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export type { CategoryView }

export const listCategories = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const d = data as { workspaceId?: string }
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return { workspaceId: d.workspaceId }
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    return getCategories(ownerId, data.workspaceId)
  })

export const createCategory = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { workspaceId: string; name: string; description?: string; icon?: string; color?: string }
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    if (!d?.name || d.name.trim().length === 0) throw new Error('Category name is required')
    if (d.name.length > 40) throw new Error('Name max 40 characters')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    return addCategory(ownerId, data.workspaceId, data)
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; workspaceId: string }
    if (!d?.id) throw new Error('id is required')
    if (!d?.workspaceId) throw new Error('workspaceId is required')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    await removeCategory(ownerId, data.workspaceId, data.id)
    return { ok: true }
  })
