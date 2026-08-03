import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type MemberStatus = 'pending' | 'accepted' | 'rejected' | 'active'

export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  name: text('name'),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('active'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
