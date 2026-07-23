import {
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export type Tier = 'free' | 'personal' | 'business' | 'enterprise' | 'custom'
export type LlmMode = 'cloud' | 'ollama'

// Maps a user -> tenant isolation context (AD-1, AD-11).
// Free/Personal share schema `person` + bucket `person`.
// Business/Enterprise get dedicated schema + bucket named by slug.
export const tenantMap = pgTable('tenant_map', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tier: text('tier').notNull().default('free'),
  schemaName: text('schema_name').notNull().default('person'),
  bucket: text('bucket').notNull().default('docpro-person'),
  llmMode: text('llm_mode').notNull().default('cloud'),
  orgId: text('org_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Daily usage counters per tenant (AD-12). Reset via cron/pg_cron.
export const usage = pgTable('usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD (UTC)
  chatCount: integer('chat_count').notNull().default(0),
  storageBytes: integer('storage_bytes').notNull().default(0),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
  costIdr: integer('cost_idr').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const TIER_LIMITS: Record<
  Tier,
  { storageBytes: number; tokenPerMonth: number }
> = {
  free: { storageBytes: 50 * 1024 * 1024, tokenPerMonth: 50_000 },
  personal: { storageBytes: 1 * 1024 * 1024 * 1024, tokenPerMonth: 5_000_000 },
  business: { storageBytes: 20 * 1024 * 1024 * 1024, tokenPerMonth: 50_000_000 },
  enterprise: { storageBytes: 200 * 1024 * 1024 * 1024, tokenPerMonth: 500_000_000 },
  custom: { storageBytes: 1024 * 1024 * 1024 * 1024, tokenPerMonth: 500_000_000 },
}
