import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../src/lib/schema'
import { EMBED_DIM } from '../src/lib/schema/documents'

// Idempotent provisioning of the Person tenant (AD-1) + pgvector (AD-4).
// Run once after DB is up: `npm run db:setup`.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS person`)

  // Public control tables (AD-1 / AD-12). Idempotent DDL.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_map (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE cascade,
      email text NOT NULL,
      tier text NOT NULL DEFAULT 'personal',
      schema_name text NOT NULL DEFAULT 'person',
      bucket text NOT NULL DEFAULT 'docpro-person',
      llm_mode text NOT NULL DEFAULT 'cloud',
      org_id text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS usage (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
      date text NOT NULL,
      chat_count integer NOT NULL DEFAULT 0,
      storage_bytes integer NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS person.documents (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      category text,
      note text,
      path text,
      share text NOT NULL DEFAULT 'private',
      share_with text[],
      hidden boolean NOT NULL DEFAULT false,
      expired boolean NOT NULL DEFAULT false,
      expired_at timestamptz,
      object_key text NOT NULL,
      size_bytes integer NOT NULL DEFAULT 0,
      mime text,
      status text NOT NULL DEFAULT 'processing',
      error text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS person.chunks (
      id text PRIMARY KEY,
      document_id text NOT NULL,
      owner_id text NOT NULL,
      chunk_index integer NOT NULL DEFAULT 0,
      content text NOT NULL,
      embedding vector(${EMBED_DIM}),
      category text,
      path text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `))

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS chunks_owner_idx ON person.chunks (owner_id)`,
  )
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS chunks_doc_idx ON person.chunks (document_id)`,
  )

  // Evolve existing tables (idempotent).
  await db.execute(
    sql`ALTER TABLE person.documents ADD COLUMN IF NOT EXISTS expired_at timestamptz`,
  )
  await db.execute(
    sql`ALTER TABLE person.documents ADD COLUMN IF NOT EXISTS error text`,
  )

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS person.categories (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL UNIQUE,
      description text,
      icon text NOT NULL DEFAULT '📁',
      color text NOT NULL DEFAULT '#2563EB',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS person.share_links (
      id text PRIMARY KEY,
      document_id text NOT NULL,
      owner_id text NOT NULL,
      token text NOT NULL UNIQUE,
      mode text NOT NULL DEFAULT 'public',
      share_with text[],
      expires_at timestamptz,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `)

  // Evolve chunks + documents with Document Intelligence metadata (idempotent).
  const chunkCols = [
    'filename text',
    'title text',
    'heading text',
    'sub_heading text',
    'section text',
    'subsection text',
    'parent_heading text',
    'parent_id text',
    'heading_path text',
    'page integer',
    'language text NOT NULL DEFAULT \'id\'',
    'total_chunks integer NOT NULL DEFAULT 1',
  ]
  for (const col of chunkCols) {
    await db.execute(sql.raw(`ALTER TABLE person.chunks ADD COLUMN IF NOT EXISTS ${col}`))
  }
  const docCols = [
    'chunks_count integer NOT NULL DEFAULT 0',
    'intelligence_score jsonb',
    'structure_json jsonb',
  ]
  for (const col of docCols) {
    await db.execute(sql.raw(`ALTER TABLE person.documents ADD COLUMN IF NOT EXISTS ${col}`))
  }

  // Migrate the embedding column if its dimension changed (idempotent).
  // Incompatible dims can't be cast, so clear existing vectors first
  // (they must be re-embedded afterwards).
  await db.execute(
    sql.raw(`DO $$ BEGIN
      IF (SELECT atttypmod FROM pg_attribute
            WHERE attrelid = 'person.chunks'::regclass AND attname = 'embedding') - 4
         <> ${EMBED_DIM} THEN
        UPDATE person.chunks SET embedding = NULL;
        ALTER TABLE person.chunks ALTER COLUMN embedding TYPE vector(${EMBED_DIM});
      END IF;
    END $$`),
  )

  console.log('[db:setup] person schema + vector tables ready')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
