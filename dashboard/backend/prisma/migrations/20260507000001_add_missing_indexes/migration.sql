-- Migration: add_missing_indexes
--
-- Three indexes declared in schema.prisma were never materialised in any
-- prior migration file. Without these, `prisma migrate deploy` (used by CI
-- and the production Dockerfile) never creates the indexes, so:
--   • API-key lookups scan the full api_keys table instead of using the
--     key_prefix index (P2 – infra hardening).
--   • Line-movement queries against odds_snapshots always perform full
--     table scans on game_id / captured_at.
--
-- All three statements are safe to run on a live database and are
-- idempotent – IF NOT EXISTS guards prevent failure if a DBA already
-- applied the index manually.

-- api_keys: O(1) key-prefix lookup used by the API-key auth middleware
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

-- odds_snapshots: line-movement range queries (game_id) and TTL purge / CLV
-- capture queries that filter by captured_at
CREATE INDEX IF NOT EXISTS "odds_snapshots_game_id_idx" ON "odds_snapshots"("game_id");
CREATE INDEX IF NOT EXISTS "odds_snapshots_captured_at_idx" ON "odds_snapshots"("captured_at");
