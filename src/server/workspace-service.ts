import { db } from '../lib/db'
import { workspaces, documents, categories } from '../lib/schema/documents'
import { chatSessions } from '../lib/schema/chat'
import { eq, and, sql, desc } from 'drizzle-orm'
import { getVectorStore, getTenantContext } from './tenant'
import { deleteObject } from './minio'

export interface WorkspaceView {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  isDefault: boolean
  documentCount: number
}

// AD-WS-5: single owner of default-workspace provisioning. Idempotent under
// concurrency (relies on the partial unique index UNIQUE(owner_id) WHERE
// is_default, created in scripts/setup-tenant.ts). Resolution is by isDefault,
// never by name.
export async function getOrCreateDefaultWorkspace(ownerId: string): Promise<{ id: string }> {
  const existing = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.ownerId, ownerId), eq(workspaces.isDefault, true)),
    columns: { id: true },
  })
  if (existing) return { id: existing.id }

  const id = crypto.randomUUID()
  await db
    .insert(workspaces)
    .values({ id, ownerId, name: 'My Workspace', isDefault: true })
    .onConflictDoNothing()

  const again = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.ownerId, ownerId), eq(workspaces.isDefault, true)),
    columns: { id: true },
  })
  if (!again) throw new Error('Failed to create default workspace')
  return { id: again.id }
}

export async function listWorkspaces(ownerId: string): Promise<WorkspaceView[]> {
  await getOrCreateDefaultWorkspace(ownerId)
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      icon: workspaces.icon,
      color: workspaces.color,
      isDefault: workspaces.isDefault,
      documentCount: sql<number>`count(${documents.id})::int`,
    })
    .from(workspaces)
    .leftJoin(
      documents,
      and(eq(documents.workspaceId, workspaces.id), eq(documents.ownerId, ownerId)),
    )
    .where(eq(workspaces.ownerId, ownerId))
    .groupBy(workspaces.id)
    .orderBy(desc(workspaces.isDefault), workspaces.name)

  return rows as unknown as WorkspaceView[]
}

export async function createWorkspace(
  ownerId: string,
  data: { name: string; description?: string; icon?: string; color?: string },
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  await db.insert(workspaces).values({
    id,
    ownerId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    icon: data.icon || '🏛',
    color: data.color || '#2563EB',
    isDefault: false,
  })
  return { id }
}

export async function renameWorkspace(
  ownerId: string,
  id: string,
  name: string,
): Promise<void> {
  await db
    .update(workspaces)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(workspaces.id, id), eq(workspaces.ownerId, ownerId)))
}

// AD-WS-7: delete a non-default workspace with a full cascade.
// - blocks while any document is still processing (serializes against ingest)
// - enumerates MinIO object keys BEFORE deleting rows (MinIO has no FK cascade)
// - cleans vector-store points for the workspace (pgvector chunks or Qdrant)
// - cleans chat session references to the workspace's documents
export async function deleteWorkspace(ownerId: string, id: string): Promise<void> {
  const ws = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, id), eq(workspaces.ownerId, ownerId)),
  })
  if (!ws) throw new Error('Workspace not found')
  if (ws.isDefault) throw new Error('The default workspace cannot be deleted')

  const processing = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.workspaceId, id), eq(documents.status, 'processing')))
  if ((processing[0]?.c ?? 0) > 0) {
    throw new Error('Workspace is still processing documents. Try again in a moment.')
  }

  const docs = await db
    .select({ id: documents.id, objectKey: documents.objectKey, sizeBytes: documents.sizeBytes })
    .from(documents)
    .where(eq(documents.workspaceId, id))

  const store = await getVectorStore(ownerId)
  await store.deleteByWorkspace(id)

  const ctx = await getTenantContext(ownerId)
  for (const d of docs) {
    if (d.objectKey) await deleteObject(ctx.bucket, d.objectKey)
  }

  // Remove references from chat sessions.
  for (const d of docs) {
    await db.execute(
      sql`UPDATE ${chatSessions} SET document_ids = array_remove(document_ids, ${d.id}::text) WHERE ${chatSessions.userId} = ${ownerId}`,
    )
  }

  await db.delete(categories).where(eq(categories.workspaceId, id))
  await db.delete(documents).where(eq(documents.workspaceId, id))

  // AD-WS-7: refund storage usage for the freed bytes (same day's row).
  const freedBytes = docs.reduce((acc, d) => acc + (d.sizeBytes ?? 0), 0)
  if (freedBytes > 0) {
    await db.execute(
      sql`UPDATE usage SET storage_bytes = GREATEST(0, storage_bytes - ${freedBytes}), updated_at = now()
          WHERE user_id = ${ownerId} AND date = ${new Date().toISOString().slice(0, 10)}::text`,
    )
  }

  await db.delete(workspaces).where(eq(workspaces.id, id))
}
