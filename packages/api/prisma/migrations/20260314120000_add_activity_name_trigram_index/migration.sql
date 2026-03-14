-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on Activity.name for fast ILIKE/contains queries
CREATE INDEX IF NOT EXISTS "Activity_name_trgm_idx"
  ON "Activity" USING gin ("name" gin_trgm_ops);
