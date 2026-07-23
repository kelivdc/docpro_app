import { pgTable, text, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core'

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default('New Chat'),
  documentIds: text('document_ids').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export interface MessageCost {
  prompt: number
  completion: number
  total: number
  costUsd: number
  costIdr: number
}

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources'),
  cost: jsonb('cost'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
