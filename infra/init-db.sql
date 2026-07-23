-- DocPro DB init (AD-1, AD-8, AR-1)
-- public schema: auth + tenant routing + usage
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS public;

-- tenant mapping: user_id -> schema + bucket + llm mode (AD-1, AR-1)
CREATE TABLE IF NOT EXISTS public.tenant_map (
  user_id TEXT PRIMARY KEY,
  schema_name TEXT NOT NULL,
  bucket TEXT NOT NULL,
  llm_mode TEXT NOT NULL DEFAULT 'cloud',
  tier TEXT NOT NULL DEFAULT 'free'
);

-- usage counter (AR-8): chat per day
CREATE TABLE IF NOT EXISTS public.usage (
  user_id TEXT NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  chat_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Free/Personal shared schema placeholder (AD-1)
CREATE SCHEMA IF NOT EXISTS person;
