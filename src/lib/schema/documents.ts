import { boolean, integer, jsonb, pgSchema, text, timestamp, customType } from 'drizzle-orm/pg-core'

// Embedding dimension must match the configured embedding model
// (EMBEDDING_MODEL=nomic-embed-text => 768). Keep this in sync with llm.ts.
export const EMBED_DIM = 768

// pgvector column. Stored as native vector for similarity search.
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBED_DIM})`
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((n) => Number(n))
  },
})

// Schema `person` for Free/Personal tenants (AD-1).
// Dedicated schemas for Business/Enterprise reuse the same shape via raw SQL.
export const person = pgSchema('person')

export const documents = person.table('documents', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  note: text('note'),
  path: text('path'),
  share: text('share').notNull().default('private'), // private|public|user|departemen
  shareWith: text('share_with').array(),
  hidden: boolean('hidden').notNull().default(false),
  expired: boolean('expired').notNull().default(false),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  objectKey: text('object_key').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  mime: text('mime'),
  status: text('status').notNull().default('processing'), // processing|ready|error
  error: text('error'),
  sourceType: text('source_type').notNull().default('document'),
  chunksCount: integer('chunks_count').notNull().default(0),
  // Document Intelligence outputs
  intelligenceScore: jsonb('intelligence_score'),
  structureJson: jsonb('structure_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const chunks = person.table('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  ownerId: text('owner_id').notNull(),
  filename: text('filename'),
  chunkIndex: integer('chunk_index').notNull().default(0),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  category: text('category'),
  path: text('path'),
  // Document Intelligence metadata
  title: text('title'),
  heading: text('heading'),
  subHeading: text('sub_heading'),
  section: text('section'),
  subsection: text('subsection'),
  parentHeading: text('parent_heading'),
  parentId: text('parent_id'),
  headingPath: text('heading_path'),
  page: integer('page'),
  language: text('language').notNull().default('id'),
  totalChunks: integer('total_chunks').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const categories = person.table('categories', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull().unique(),
  description: text('description'),
  icon: text('icon').notNull().default('📁'),
  color: text('color').notNull().default('#2563EB'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Share links (AD-8/AD-11). token-based public/User/Departemen sharing.
export const shareLinks = person.table('share_links', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  ownerId: text('owner_id').notNull(),
  token: text('token').notNull().unique(),
  mode: text('mode').notNull().default('public'), // public|user|departemen
  shareWith: text('share_with').array(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
