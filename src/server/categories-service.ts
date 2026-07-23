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

export async function getCategories(ownerId: string): Promise<{
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
      and(eq(documents.category, categories.name), eq(documents.ownerId, ownerId)),
    )
    .where(eq(categories.ownerId, ownerId))
    .groupBy(categories.id)
    .orderBy(categories.name)

  const uncategorized = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.ownerId, ownerId), isNull(documents.category)))

  return { categories: rows as CategoryView[], uncategorized: uncategorized[0]?.c ?? 0 }
}

export async function addCategory(
  ownerId: string,
  data: { name: string; description?: string; icon?: string; color?: string },
): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  await db.insert(categories).values({
    id,
    ownerId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    icon: data.icon || '📁',
    color: data.color || '#2563EB',
  })
  return { id }
}

export async function removeCategory(ownerId: string, id: string): Promise<void> {
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.ownerId, ownerId)))
}
