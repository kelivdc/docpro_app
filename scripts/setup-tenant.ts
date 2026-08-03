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
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      workspace_id text,
      title text NOT NULL DEFAULT 'New Chat',
      document_ids text[],
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE cascade,
      role text NOT NULL CHECK (role IN ('user', 'assistant')),
      content text NOT NULL,
      sources jsonb,
      cost jsonb,
      created_at timestamp NOT NULL DEFAULT now()
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

  // ---- Workspace support (AD-WS-2/3/4/5) ----
  // Idempotent: add workspace_id columns, backfill to a default workspace per
  // owner, then swap unique constraints & enforce NOT NULL.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS person.workspaces (
      id text PRIMARY KEY,
      owner_id text NOT NULL,
      name text NOT NULL,
      description text,
      icon text NOT NULL DEFAULT '📁',
      color text NOT NULL DEFAULT '#2563EB',
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT workspaces_owner_name_unique UNIQUE (owner_id, name)
    )
  `)
  await db.execute(
    sql`ALTER TABLE person.documents ADD COLUMN IF NOT EXISTS workspace_id text`,
  )
  await db.execute(
    sql`ALTER TABLE person.chunks ADD COLUMN IF NOT EXISTS workspace_id text`,
  )
  await db.execute(
    sql`ALTER TABLE person.categories ADD COLUMN IF NOT EXISTS workspace_id text`,
  )
  await db.execute(
    sql`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id text`,
  )
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_idx ON person.workspaces (owner_id) WHERE is_default`,
  )
  await db.execute(
    sql`UPDATE person.workspaces SET icon = '🏛' WHERE icon = '📁'`,
  )

  // Backfill: ensure one default workspace per owner that owns data, then point
  // all rows with NULL workspace_id at it. Idempotent via ON CONFLICT DO NOTHING.
  // chat_sessions is a public-schema table; its owner column is user_id.
  await db.execute(sql.raw(`
    INSERT INTO person.workspaces (id, owner_id, name, is_default)
    SELECT gen_random_uuid()::text, o.owner_id, 'My Workspace', true
    FROM (
      SELECT owner_id FROM person.documents WHERE workspace_id IS NULL
      UNION
      SELECT owner_id FROM person.categories WHERE workspace_id IS NULL
      UNION
      SELECT owner_id FROM person.chunks WHERE workspace_id IS NULL
      UNION
      SELECT user_id AS owner_id FROM chat_sessions WHERE workspace_id IS NULL
    ) o
    ON CONFLICT DO NOTHING
  `))
  await db.execute(sql.raw(`
    UPDATE person.documents d
    SET workspace_id = w.id
    FROM person.workspaces w
    WHERE d.workspace_id IS NULL AND w.owner_id = d.owner_id AND w.is_default = true
  `))
  await db.execute(sql.raw(`
    UPDATE person.chunks c
    SET workspace_id = w.id
    FROM person.workspaces w
    WHERE c.workspace_id IS NULL AND w.owner_id = c.owner_id AND w.is_default = true
  `))
  await db.execute(sql.raw(`
    UPDATE person.categories c
    SET workspace_id = w.id
    FROM person.workspaces w
    WHERE c.workspace_id IS NULL AND w.owner_id = c.owner_id AND w.is_default = true
  `))
  await db.execute(sql.raw(`
    UPDATE chat_sessions cs
    SET workspace_id = w.id
    FROM person.workspaces w
    WHERE cs.workspace_id IS NULL AND w.owner_id = cs.user_id AND w.is_default = true
  `))
  await db.execute(sql.raw(`
    UPDATE person.workspaces SET name = 'My Workspace' WHERE is_default = true AND name = 'Default'
  `))

  // Swap category uniqueness: drop the global unique, add per-workspace unique.
  // Drizzle's `name text UNIQUE` auto-names it `categories_name_key`; older
  // manifest-based setups used `categories_name_unique` — drop both defensively.
  await db.execute(
    sql`ALTER TABLE person.categories DROP CONSTRAINT IF EXISTS categories_name_unique`,
  )
  await db.execute(
    sql`ALTER TABLE person.categories DROP CONSTRAINT IF EXISTS categories_name_key`,
  )
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS categories_workspace_name_idx ON person.categories (workspace_id, name)`,
  )

  // Enforce NOT NULL once backfilled.
  await db.execute(
    sql`ALTER TABLE person.documents ALTER COLUMN workspace_id SET NOT NULL`,
  )
  await db.execute(
    sql`ALTER TABLE person.chunks ALTER COLUMN workspace_id SET NOT NULL`,
  )
  await db.execute(
    sql`ALTER TABLE person.categories ALTER COLUMN workspace_id SET NOT NULL`,
  )

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
    'source_type text NOT NULL DEFAULT \'document\'',
    'chunks_count integer NOT NULL DEFAULT 0',
    'intelligence_score jsonb',
    'structure_json jsonb',
  ]
  for (const col of docCols) {
    await db.execute(sql.raw(`ALTER TABLE person.documents ADD COLUMN IF NOT EXISTS ${col}`))
  }

  // Ensure chat_sessions has document_ids (added after initial migration)
  await db.execute(sql.raw(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS document_ids text[]`))
  await db.execute(sql.raw(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS cost jsonb`))

  // Soft-delete support
  await db.execute(sql.raw(`ALTER TABLE tenant_map ADD COLUMN IF NOT EXISTS deleted_at timestamptz`))
  await db.execute(sql.raw(`ALTER TABLE tenant_map ADD COLUMN IF NOT EXISTS purged_at timestamptz`))

  // Top-up / subscription support
  await db.execute(sql.raw(`ALTER TABLE tenant_map ADD COLUMN IF NOT EXISTS topup_used integer NOT NULL DEFAULT 0`))

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
      tier text NOT NULL,
      started_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS topup_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
      amount integer NOT NULL,
      purchase_price real NOT NULL,
      purchased_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL,
      status text NOT NULL DEFAULT 'active'
    )
  `)

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
