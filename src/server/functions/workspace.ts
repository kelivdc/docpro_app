import { createServerFn } from '@tanstack/react-start'
import { auth } from '../../lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import {
  listWorkspaces,
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  type WorkspaceView,
} from '../workspace-service'

function currentUserId(): Promise<string> {
  return auth.api
    .getSession({ headers: getRequest()?.headers })
    .then((s) => {
      const id = s?.user?.id
      if (!id) throw new Error('UNAUTHENTICATED')
      return id
    })
}

export type { WorkspaceView }

export const listWorkspacesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const ownerId = await currentUserId()
  return listWorkspaces(ownerId)
})

export const createWorkspaceFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { name: string; description?: string; icon?: string; color?: string }
    if (!d?.name || d.name.trim().length === 0) throw new Error('Nama workspace wajib')
    if (d.name.length > 60) throw new Error('Nama maksimal 60 karakter')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    return createWorkspace(ownerId, data)
  })

export const renameWorkspaceFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string; name: string }
    if (!d?.id || !d?.name || d.name.trim().length === 0) throw new Error('id dan nama wajib')
    if (d.name.length > 60) throw new Error('Nama maksimal 60 karakter')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    await renameWorkspace(ownerId, data.id, data.name)
    return { ok: true }
  })

export const deleteWorkspaceFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const d = data as { id: string }
    if (!d?.id) throw new Error('id wajib')
    return d
  })
  .handler(async ({ data }) => {
    const ownerId = await currentUserId()
    await deleteWorkspace(ownerId, data.id)
    return { ok: true }
  })
