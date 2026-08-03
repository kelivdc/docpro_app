import { db } from '../lib/db'
import { categories, documents } from '../lib/schema/documents'
import { eq, sql, and, isNull } from 'drizzle-orm'

export interface CategoryView {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  count: number
}

export async function getCategories(
  ownerId: string,
  workspaceId: string,
): Promise<{
  categories: CategoryView[]
  uncategorized: number
}> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      color: categories.color,
      count: sql<number>`count(${documents.id})::int`,
    })
    .from(categories)
    .leftJoin(
      documents,
      and(
        eq(documents.category, categories.name),
        eq(documents.ownerId, ownerId),
        eq(documents.workspaceId, workspaceId),
      ),
    )
    .where(and(eq(categories.ownerId, ownerId), eq(categories.workspaceId, workspaceId)))
    .groupBy(categories.id)
    .orderBy(categories.name)

  const uncategorized = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, ownerId),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.category),
      ),
    )

  return { categories: rows as CategoryView[], uncategorized: uncategorized[0]?.c ?? 0 }
}

export async function addCategory(
  ownerId: string,
  workspaceId: string,
  data: { name: string; description?: string; icon?: string; color?: string },
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  await db.insert(categories).values({
    id,
    ownerId,
    workspaceId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    icon: data.icon || '📁',
    color: data.color || '#2563EB',
  })
  return { id }
}

export async function removeCategory(ownerId: string, workspaceId: string, id: string): Promise<void> {
  const cat = await db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.ownerId, ownerId), eq(categories.workspaceId, workspaceId)),
    columns: { name: true },
  })
  if (!cat) return

  // AD-WS-9: deleting a category is transactional against documents.category —
  // documents tagged with it become uncategorized (NULL) in the same workspace.
  await db
    .update(documents)
    .set({ category: null })
    .where(
      and(
        eq(documents.ownerId, ownerId),
        eq(documents.workspaceId, workspaceId),
        eq(documents.category, cat.name),
      ),
    )
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.ownerId, ownerId), eq(categories.workspaceId, workspaceId)))
}

// AD-WS-9: a category tag on a document must be a (workspaceId, name) row in the
// SAME workspace. Returns false when the category belongs to another workspace or
// does not exist here.
export async function categoryExists(ownerId: string, workspaceId: string, name: string): Promise<boolean> {
  const row = await db.query.categories.findFirst({
    where: and(eq(categories.ownerId, ownerId), eq(categories.workspaceId, workspaceId), eq(categories.name, name)),
    columns: { id: true },
  })
  return !!row
}
