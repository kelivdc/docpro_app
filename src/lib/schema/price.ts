import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, bigint } from 'drizzle-orm/pg-core'

export type PriceType = 'plan' | 'topup'
export type PriceStatus = 'active' | 'inactive'

// Pricing catalog (public.price).
// Editable by admins; consumed by the landing pricing page and dashboard plans page.
export const price = pgTable('price', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'plan' | 'topup'
  name: text('name').notNull(),
  tier: text('tier'), // for plan type: free | pro | business | enterprise
  price: numeric('price').notNull().default('0'),
  currency: text('currency').notNull().default('USD'),
  tokens: bigint('tokens', { mode: 'number' }), // for topup type
  features: jsonb('features').$type<string[]>(),
  note: text('note'),
  highlighted: boolean('highlighted').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Price = typeof price.$inferSelect
