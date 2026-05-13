# Backend Changelog

All notable changes to the Dashboard Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.3.6] - 2026-05-12

### Fixed

- **h2h moneyline disagreement ignores away-price divergence** (`src/services/market-consensus.service.ts` — `calculateConsensus`): Consensus, standard deviation, outlier detection, and the disagreement score for `h2h` markets were computed exclusively from home implied probabilities. A market where away prices diverge across bookmakers while home prices remain stable produced a score of 0 and was never surfaced by `/analytics/disagreement/live` or the Value Opportunities page. Fixed by computing independent scores for both home and away sides: `homeScore = computeScore(stdDev(homeProbs), consensusHomeProb)` and `awayScore = computeScore(stdDev(awayProbs), consensusAwayProb)`. The persisted `disagreementScore` is `max(homeScore, awayScore)`, the `standardDeviation` comes from the dominant side, and outliers from both sides are merged (keeping the entry with the larger absolute deviation when a bookmaker appears on both sides). The consensus line is still reported as home American odds for UI consistency.

---

## [0.3.5] - 2026-05-12

### Fixed

- **Stale pregame opportunities shown for already-started games with delayed status updates** (`src/services/market-consensus.service.ts` — `findHighDisagreement`): The previous fix added `game.status = 'scheduled'` to exclude in-progress and completed games, but this is insufficient when the status job hasn't yet advanced a game from `'scheduled'` to `'in_progress'` after kickoff. During that lag window the game still passes the status filter and its last pregame consensus row continues to appear in `/analytics/disagreement/live` as a bettable opportunity. Fixed by adding `game.commenceTime > now()` alongside the status filter. A game that has already passed its scheduled start time is now excluded regardless of whether the status job has caught up.
- **Steam moves never classified during normal operation** (`src/services/line-movement.service.ts` — `classifyMovement`): The steam condition required `timeElapsed < 120` seconds (under 2 minutes), but the odds sync job runs every 10 minutes by default, so consecutive sync batches produce `timeElapsed ≈ 600 s`. Every coordinated multi-book move detected between normal sync cycles failed the time check and was downgraded to `'normal'`, making the steam filter effectively empty in production. Fixed by relaxing the threshold to `timeElapsed < 900` seconds (15 minutes) to accommodate the default 10-minute sync interval plus timing variance, while still distinguishing rapid (steam) from slow drift (gradual, `> 3600 s`).

---

## [0.3.4] - 2026-05-12

### Fixed

- **Gradual line movements never detected despite 120-minute lookback** (`src/services/line-movement.service.ts` — `detectMovements`): Even with the 120-minute lookback added in v0.3.3, `detectMovements` only compared consecutive sync batches (~10-minute intervals, ~600 s). Because `classifyMovement` requires `timeElapsed > 3600` seconds to classify a move as "gradual", every pair produced by the consecutive loop was far below the threshold, leaving the gradual filter empty during normal operation. Fixed by adding a dedicated gradual-detection pass (Pass 2) that compares the oldest batch in the lookback window directly against the newest batch (~7200 s across the full 120-minute window), satisfying the threshold. Persistence is restricted to `movementType === 'gradual'` results only, so Pass 1's steam and normal classifications are not double-persisted for the boundary pair. The `sinceTime` cursor is respected to prevent duplicate rows on overlapping job runs.

---

## [0.3.3] - 2026-05-12

### Fixed

- **Gradual line movements never detected by scheduled job** (`src/jobs/line-movement.job.ts`): The job called `detectMovements` with a 10-minute lookback window, but `classifyMovement` classifies a move as "gradual" only when `timeElapsed > 3600` seconds (1 hour). Since every snapshot pair bounded by 10 minutes had `timeElapsed < 3600`, gradual movements could never be persisted, leaving the gradual filter empty in the API and UI. Fixed by increasing the lookback to 120 minutes (2 hours), enabling detection of slow drift over extended periods. Duplicate persistence on overlapping runs is prevented by the existing `sinceTime` cursor mechanism.
- **Live disagreement list shows stale pregame opportunities for in-progress/completed games** (`src/services/market-consensus.service.ts` — `findHighDisagreement`): The consensus job only calculates rows for `status: 'scheduled'` games before they start. After a game's status changes to `in_progress` or `completed`, new consensus rows stop being created, but the last pregame row can still fall within the 2-hour lookback window. This caused `/analytics/disagreement/live` and the Value Opportunities page to advertise stale betting opportunities for games that had already started or finished. Fixed by adding `game: { status: 'scheduled' }` filter to the query, so only pregame consensus rows are returned.

---

## [0.3.2] - 2026-05-12

### Fixed

- **`/analytics/disagreement/live` shows stale and duplicate opportunities** (`src/services/market-consensus.service.ts` — `findHighDisagreement`): The query filtered all `MarketConsensus` rows from the last 30 minutes where `disagreementScore >= threshold`. Because the consensus job inserts a new row every 15 minutes rather than updating in place, a market that scored high at T+0 but dropped below the threshold at T+15 continued to appear until the T+0 row aged out of the 30-minute window. The same game+market pair could also appear twice (both the old and new rows matched). Fixed with a two-step approach: (1) `groupBy(gameId, marketType)` with `_max: calculatedAt` to identify the single latest row per game+market pair across a 2-hour lookback; (2) fetch only those specific rows and apply the threshold filter. The threshold is now evaluated exclusively on the current consensus, not on any stale predecessors.
- **Steam classification triggered by split/opposing bookmaker movements** (`src/services/line-movement.service.ts` — `analyzeMovement`): When multiple books moved in opposite directions within the same sync window (e.g. two books +1.5, two books −1.5 on a spread), all absolute changes were pooled into `bookmakerCount` and `avgMovement` before `classifyMovement` evaluated the steam thresholds. A perfectly split market with four total movers and a large absolute average could be persisted as a steam move, contradicting the classifier's requirement for coordinated directional movement. Fixed by partitioning movers by sign before classification: the dominant direction group (most books; ties broken by larger average absolute change) is used to compute `bookmakerCount` and `avgMovement` passed to `classifyMovement`. `maxMovement` still reflects all movers as metadata. Steam can now only fire when ≥ 3 books moved in the same direction.
- **bestValue always reports home/over side, missing away/under opportunities** (`src/services/market-consensus.service.ts` — `calculateConsensus`): All three market types (h2h, spreads, totals) were hardcoded to report only one side: `side: 'home'` for h2h and spreads, `side: 'over'` for totals. Even when the best odds were on the away or under side, the API returned the opposite side, so the value-opportunity UI could direct users to inferior prices or miss best-value markups entirely (e.g. a mispriced away moneyline or under was never surfaced). Fixed by comparing both sides for each market type and picking whichever has the numerically higher odds (most favorable for the bettor). The `side` field now correctly reflects where the actual best value is.

---

## [0.3.1] - 2026-05-12

### Fixed

- **Line movement job misses live games and processes stale historical backlog** (`src/jobs/line-movement.job.ts`): Two related issues in the game filter:
  1. The status filter used `'inprogress'` and `'live'` but the backend writes `'in_progress'` when a game transitions from scheduled (e.g. `OutcomeResolverService`). Once a game went live the job no longer matched it, silently dropping all live line movements. Added `'in_progress'` to the `status.in` array.
  2. The `commenceTime` filter had no lower bound — only an upper bound 48 hours in the future. Any old game left in a non-completed status was included on every 5-minute run, causing the job to call `detectMovements` for the entire historical backlog and making runtime scale with all past data. Added a `gte: sixHoursAgo` lower bound so only games that started within the last 6 hours (still plausibly in-progress) or are upcoming are processed.
- **Duplicate `LineMovement` rows from overlapping detection windows** (`src/jobs/line-movement.job.ts`, `src/services/line-movement.service.ts`): `detectMovements` fetches a 10-minute lookback window on every 5-minute job run, so any snapshot pair that falls inside two consecutive windows was persisted twice. The job now tracks `lastRunAt` and passes it as `sinceTime` to `detectMovements`. The service keeps the wider lookback so there is always a "before" batch available, but skips `persist` for any snapshot pair whose "after" timestamp is `<= sinceTime` (already processed). `lastRunAt` is only advanced after a fully successful run so a partial failure does not silently skip unprocessed pairs.

---

## [0.3.0] - 2026-05-12

### Added

- **Line Movement Detection & Tracking — Phase 1** (Issue #5): Detects and analyzes odds line movements across bookmakers to identify steam moves, sharp action, and market activity patterns. Scheduled job runs every 5 minutes to detect movements and classify them for analytical and trading insights.
  - `prisma/schema.prisma`: Enhanced `OddsSnapshot` model with movement detection fields (`movementType`, `movementSize`, `volumeIndicator`). New `LineMovement` model stores detected movements with before/after line snapshots, bookmaker count, average movement size, and time elapsed. Migration: `20260509040701_add_line_movement_tracking`.
  - `src/services/line-movement.service.ts`: `LineMovementService` with `detectMovements()` (compares snapshots, classifies movements), `classifyMovement()` (steam/reverse/gradual), `getGameMovements()`, `getMovementsByType()`, `getRecentMovements()`, `getSteamMoves()`, and `getMovementStats()`.
  - `src/jobs/line-movement.job.ts`: Scheduled job (`*/5 * * * *`) that runs every 5 minutes, detects movements across all active/upcoming games, logs steam moves prominently with movement classification, and persists `LineMovement` records.
  - `src/routes/analytics-movements.routes.ts`: Five new authenticated endpoints: `GET /api/analytics/movements/live` (recent steam/reverse/gradual moves), `GET /api/analytics/movements/game/:gameId` (movements for a specific game), `GET /api/analytics/movements/history` (historical data with statistics), `GET /api/analytics/movements/bookmaker/:bookmaker` (movements detected by a specific bookmaker), `GET /api/analytics/movements/stats` (movement summary statistics).
  - `src/server.ts`: `initLineMovementJob(prisma)` registered alongside other scheduled jobs on server startup.
  - Database integration: Migrations support new fields and model, Prisma Client types generated automatically.

### Fixed

- **Steam move detection — timestamp-based batch grouping** (`src/services/line-movement.service.ts`): `detectMovements` previously grouped snapshots by `"market:bookmaker"` key, meaning each bookmaker's timeline was compared in isolation. This produced singleton arrays `[before]` / `[after]` for every comparison, so `bookmakerCount` was always 1 and the steam threshold (≥ 3 bookmakers) was unreachable — all movements were classified as `normal` and never persisted. Refactored to `groupSnapshotsByMarketAndTime`: snapshots are now grouped by market type and `capturedAt` timestamp so every bookmaker from the same sync cycle forms a single batch. Consecutive sync batches are compared (T1 batch vs T2 batch), `buildLineSnapshot` receives multiple same-cycle snapshots, and `classifyMovement` now correctly receives arrays with actual bookmaker counts, enabling steam detection to work as designed.
- **American odds best-value comparators** (`src/services/market-consensus.service.ts`): Conditional sign-checking comparators (e.g. `a < 0 ? a - b : b - a`) sorted negative American odds ascending so −150 ranked above −105, identifying worse prices as best value. Replaced all three comparators (h2h, spreads, totals) with a simple descending numerical sort (`.sort((a, b) => b.price! - a.price!)[0]`) — the highest number always represents the best payout regardless of sign.

---

## [0.2.16] - 2026-05-08

### Added

- **Bookmaker Disagreement Detection — Phase 1** (Issue #4): Detects market uncertainty by calculating consensus lines and disagreement scores across all bookmakers for each upcoming game.
  - `prisma/schema.prisma`: New `MarketConsensus` model with consensus line, standard deviation, outlier bookmakers, bookmaker count, disagreement score (1–100), and best-value indicator. Migration: `20260507000002_add_market_consensus`.
  - `src/services/market-consensus.service.ts`: `MarketConsensusService` with `calculateConsensus()` (h2h, spreads, totals), `runBatchCalculation()` (upcoming 48 h), `findHighDisagreement()`, `getDisagreementForGame()`, `getDisagreementHistory()`, and `getBookmakerOutlierStats()`.
  - `src/jobs/consensus-calc.job.ts`: Scheduled job (`*/15 * * * *`) that runs batch consensus calculation on startup and every 15 minutes.
  - `src/routes/analytics-disagreement.routes.ts`: Four new authenticated endpoints: `GET /api/analytics/disagreement/live`, `GET /api/analytics/disagreement/game/:gameId`, `GET /api/analytics/disagreement/trends`, `GET /api/analytics/disagreement/bookmaker/:bookmaker`.
  - `src/server.ts`: `startConsensusCalcJob()` registered alongside existing scheduled jobs.
- **Team stats lookup by league and name** (`src/routes/stats.routes.ts`): New `GET /api/stats/teams/:league/:teamName` endpoint resolves a team by sport key and case-insensitive name, then returns season stats, home/away/overall splits, and recent game history. When the team has no record in the database yet the endpoint returns the team name and empty splits so the frontend page always renders.

### Fixed

- **OAuth callback redirects to initiating frontend** (`routes/auth.routes.ts`, `services/oauth.service.ts`, `types/auth.types.ts`): When `CORS_ORIGIN` contains multiple allowed origins, callbacks now redirect to the origin that started the login instead of always using the first entry
- **Dry-run mode dirtied worktree** (`scripts/bump-version.mjs`): `npm run bump -- --dry-run` no longer writes to `package.json` or `CHANGELOG.md` files; all writes are gated behind the non-dry-run branch

---


## [0.2.15] - 2026-05-07

### Fixed

- **Missing Prisma migration for three schema indexes** (`prisma/migrations/20260507000001_add_missing_indexes/migration.sql`): Three indexes present in `schema.prisma` had no corresponding migration SQL, so `prisma migrate deploy` (used by CI and the production Dockerfile) never created them in deployed databases: `api_keys_key_prefix_idx` (O(1) API-key auth lookup, P2 infra hardening), `odds_snapshots_game_id_idx`, and `odds_snapshots_captured_at_idx` (line-movement and CLV-capture queries). All three `CREATE INDEX IF NOT EXISTS` statements are safe to apply on a live database.

---

## [0.2.14] - 2026-05-07

### Fixed

- **OAuth callback redirects to initiating frontend** (`routes/auth.routes.ts`, `services/oauth.service.ts`, `types/auth.types.ts`): When `CORS_ORIGIN` contains multiple allowed origins, every callback was redirected to the first entry regardless of which frontend started the login. Now `beginOAuth` captures and validates the `Origin` request header (falling back to `Referer`), stores the validated origin in the session, and `handleOAuthCallback` passes it to `buildFrontendRedirect`. Unrecognised origins are silently discarded and the existing fallback is used. (P2 issue — multi-origin / preview-env deployments)

---

## [0.2.13] - 2026-05-07

### Fixed

- **Admin routes inaccessible in no-auth mode** (`middleware/auth-session.middleware.ts`): When `AUTH_MODE=none`, `attachAuthSession` now attaches a synthetic local admin user so `requireAdminAccess` is satisfied without an OAuth flow being configured

---

## [0.2.12] - 2026-05-06

### Added

- **CLV service unit tests** (`tests/clv.service.test.ts`): 21 tests covering calculation accuracy, closing line capture, per-bet CLV, report generation, and edge cases (Issue #3)

---

## [0.2.11] - 2026-04-14

### Added
- **Data retention policies and cleanup jobs** (Issue #19):
  - New `cleanup-old-records.job.ts`: Scheduled job to clean up old data records daily at 2 AM UTC
  - OddsSnapshot records: 30-day retention policy (automatically deleted after 30 days)
  - ApiKeyUsage records: 90-day retention policy (automatically deleted after 90 days)
  - Prevents unbounded data growth in database

### Fixed
- **OddsSnapshot table missing index** (schema.prisma): Added index on capturedAt field
  - Improves query performance when filtering/deleting by captured timestamp
  - Supports retention policy cleanup queries
- **Site config PUT lacks Zod validation** (admin.routes.ts): Added URL validation using Zod schema with `.url()` validator
  for logoUrl and domainUrl fields to prevent XSS attacks via malicious URLs
- **Force delete bypass authorization** (bets.routes.ts): Added admin authorization check for force delete query parameter
  - Force deletes now return 403 Forbidden if non-admin user attempts the operation
  - Regular users can still cancel their own pending bets without games started
  - Only admins can use ?force=true to bypass settlement/game-started validation
- **Admin routes tests missing authentication** (admin.routes.test.ts): Added mock for requireAdminAccess middleware
  to properly authenticate test requests to protected admin endpoints
- **Bookmaker null checks in API sync services** (odds-sync.service.ts, futures-sync.service.ts):
  Added guards against undefined bookmakers that caused "Cannot read properties of undefined" errors
  - Futures sync now handles missing bookmakers array
  - Odds sync now handles missing bookmakers array
  - Error messages safely access bookmaker.key with optional chaining

---

## [0.2.10] - 2026-04-14

### Changed
- **CI/CD Pipeline**: Enhanced GitHub Actions test.yml to include 'dev' branch in pull_request and push triggers
  - Tests now run automatically on PRs to dev branch
  - Tests now run automatically on pushes to dev branch
  - Maintains existing triggers for main, beta, and develop branches

---

## [0.2.9] - 2026-04-14

### Fixed
- **Home/away detection by array index** (odds-sync.service.ts): Changed from array position matching to team name
  matching to correctly identify home/away teams regardless of Odds API outcome order
- **Teaser sport hardcoded to NFL** (bet.service.ts): Made `calculateBetOdds()` async to resolve teaser sport
  from first leg's game record instead of hardcoding to 'nfl', fixing incorrect payouts for NBA/other sport teasers
- **legsSettled counter always returns 0** (outcome-resolver.service.ts): Fixed settlement to return proper leg count
  instead of unused `const legsSettled = 0` declaration

---

## [0.2.8] - 2026-04-14

### Fixed
- **Duplicate code in auth-session.middleware.ts**: Removed 246 lines of broken duplicate functions
  that referenced an undefined `sessions` map instead of the proper `sessionStore` (Redis/in-memory)
- **Missing `await` in auth.routes.ts**: Added `await` to `ensureAuthSession()`, `createAuthenticatedSession()`,
  and `destroyAuthSession()` calls to ensure Redis session operations complete correctly
- Made logout route handler async to properly await session destruction

---

## [0.2.7] - 2026-04-14

### Added
- **CLV (Closing Line Value) Tracking**: Complete backend implementation for Phase 1 analytics (Issue #3)
  - Database schema changes: Added `closingOdds`, `clv`, and `clvCategory` fields to BetLeg model
  - New UserCLVStats model for aggregated analytics by sport/betType/period
  - CLV calculation service with American odds to implied probability conversion
  - 6 REST API endpoints: summary, by-sport, by-bookmaker, trends, report, calculate, update-stats
  - Scheduled job to capture closing lines every 5 minutes before games start
  - CLV formula: `((Closing Implied Prob - Opening Implied Prob) / Opening Implied Prob) * 100`
  - Categories: positive (CLV ≥ 2%), neutral (-2% < CLV < 2%), negative (CLV ≤ -2%)
- **Version Bump System**: Automated semantic versioning for monorepo components (dev branch)
  - File hashing system (`scripts/bump-version.mjs`) to detect changes in MCP, backend, and frontend
  - Automatic semantic version bumping on code changes with `npm run bump`
  - Preserves `package.json` and `package-lock.json` from hash tracking to avoid infinite bumps
  - Support for forced bumps: `npm run bump:patch|minor|major`
  - Stores file snapshots in `.bump-hashes.json` for change detection
  - Documentation: `scripts/BUMP-SYSTEM.md` and `scripts/BUMP-QUICK-START.md`

### Fixed
- **Critical Correctness Bugs in Odds and Settlement Logic** (Issue #15)
  - **Home/Away Detection** in `odds-sync.service.ts`: Changed from unreliable array index check (`market.outcomes.indexOf(outcome) === 0`) to team name matching. Prevents home/away odds from being swapped when Odds API doesn't guarantee outcome ordering.
  - **Teaser Sport Resolution** in `bet.service.ts`: Changed from hardcoded `'nfl'` to dynamic resolution from first leg's game record. Fixes NBA teasers incorrectly using NFL odds tables, which resulted in incorrect payouts.
  - **legsSettled Counter** in `outcome-resolver.service.ts`: Removed unused const that always returned 0. Now correctly returns `legs.length` for accurate settlement reporting.

### Security
- **Hardened Authentication and Session Management** (Issue #14)
  - CRITICAL: Removed insecure secret defaults (JWT_SECRET, SESSION_SECRET). Production startup now fails with clear error message if secrets not set
  - CRITICAL: Migrated session store from in-memory Map to Redis-backed storage with automatic fallback to in-memory for development
  - CRITICAL: Protected admin routes with mandatory authentication, even when AUTH_MODE='none' (prevents accidental exposure due to misconfiguration)
  - PERFORMANCE: Optimized API key authentication from O(n) bcrypt comparisons to O(1) indexed keyPrefix lookup
    - Added `keyPrefix` index to ApiKey model for fast database lookups
    - Now performs bcrypt comparison only on single matched key instead of all keys
    - Eliminates DoS vector from bcrypt-timing attacks when database has many API keys
  - Sessions now persist across server restarts and support horizontal scaling via Redis
  - Added proper secret validation with development-only defaults and production requirements

### Fixed
- **TypeScript Build Errors**: Resolved all 50 compilation errors in API-Sports services (Issue #13)
  - Fixed response type assertions from `unknown` to `any` in all services
  - Removed `homeScore`/`awayScore` fields from GameStats operations (not in schema)
  - Updated Player model usage to use `firstName`/`lastName` instead of `name` field
  - Added `teamId` field to all PlayerGameStats create operations (required field)
  - Added null safety checks for `game.homeTeam` and other optional relations
  - Fixed NHL period score handling (undefined → null type coercion)
  - Changed `game.sport` to `game.sportId` in Soccer service
  - **Player Upsert Pattern**: Replaced `upsert` with `findFirst` + `update`/`create` pattern
    - Reason: `externalId` is indexed but not unique in Prisma schema (only `id` is unique)
    - Applied to all services: NCAAB, NCAAF, Soccer
  - Removed invalid `externalId_sport` composite unique constraint references
  - Removed non-existent `sportId` field from Player create operations
  - Services affected: NCAAB, NCAAF, NHL, Soccer (all now compile successfully)

### Added
- **Multi-Sport Stats Integration**: API-Sports support for 6 sports
  - NFL stats service with game stats, team stats, and live game detection
  - NBA stats service with quarter scores, player stats, and shooting percentages
  - NHL stats service with period scoring and live game tracking
  - NCAA Basketball stats service with halftime scoring and player performance
  - NCAA Football stats service with position-specific player stats (passing, rushing, receiving, defense, kicking)
  - Soccer stats service supporting EPL, La Liga, Serie A, Bundesliga, Ligue 1, MLS, UEFA Champions League
- **Historical Averages API**: Enhanced stats endpoints with season-long analytics
  - `/api/stats/game/:gameId` now returns `seasonAverages` with calculated team averages
  - Averages calculated across all games this season for both home and away teams
  - Includes total games, home games, away games counts with averaged stats
- **Home/Away Filtering**: Advanced team stats filtering
  - `/api/stats/team/:teamId` accepts `location` query parameter (`home`, `away`, `all`)
  - Returns split statistics comparing home vs away performance
  - Filtered game history by location (up to 20 recent games)
  - Separate averages for home games, away games, and overall performance
- **Stats Sync Orchestration**: Unified service for all sports
  - Updated `stats-sync.service.ts` to initialize all 6 sports services
  - Parallel processing with 200ms delays between API calls for rate limiting
  - Comprehensive error tracking and logging per sport
  - Optional service initialization based on `API_SPORTS_KEY` configuration

## [0.2.2] - 2026-01-15

### Added
- **Parlay Boost Support**: Backend processing for profit-based odds boosts
  - Added `boostedCombinedOdds` field to `CreateBetInput` type
  - Updated Zod validation schema to accept optional `boostedCombinedOdds` parameter
  - Backend calculates boosted payout while preserving original odds in `oddsAtPlacement`
  - Logging for boost detection and application in bet creation

### Changed
- **Bet Odds Calculation**: Simplified parlay odds calculation
  - Removed per-leg `userAdjustedOdds` handling
  - Boost now applied only to final combined odds
  - Single `boostedCombinedOdds` parameter replaces individual leg adjustments

---

## [0.2.0] - 2026-01-12

### Added
- **Testing Infrastructure**: Comprehensive Jest test setup
  - Jest with ts-jest for TypeScript support
  - @jest/globals, jest-mock-extended, supertest for testing utilities
  - Test scripts: `test`, `test:watch`, `test:coverage`, `test:ci`
  - Coverage thresholds: 60% minimum for lines, functions, branches, statements
  - Example tests: bet.service.test.ts, odds-calculator tests
  - PostgreSQL service container support for integration tests

- **Docker Secrets Support**: Production-ready secret management
  - Dockerfile supports Docker secrets mounted at `/run/secrets/`
  - Automatic loading of secrets from files (ODDS_API_KEY, DB_PASSWORD, etc.)
  - Secret files converted to uppercase environment variables
  - Entrypoint script with secret loading, .env fallback, and migration support
  - Priority order: Docker secrets > Environment variables > .env file
  - Support for `AUTO_MIGRATE=true` to run Prisma migrations on container start

- **Live Game Tracking**: Real-time game state endpoints
  - Added `period` and `clock` fields to Game model (Prisma schema)
  - Outcome resolver service captures live game state from ESPN API
  - ESPN API integration fetches period and clock data
  - Migration: Updated database schema for live game tracking

- **Timezone-Aware Filtering**: Enhanced games endpoint
  - `/api/games` accepts `timezoneOffset` parameter (minutes)
  - Correctly filters games by date in user's local timezone
  - Prevents off-by-one date errors across timezones
  - Enhanced response format with flattened `sportKey` and `sportName` fields

- **Admin Settings API**: Site branding configuration
  - GET/PUT `/api/admin/site-config` endpoints
  - SiteConfig database table with siteName, logoUrl, domainUrl
  - Migration: `20260112174137_add_admin_settings`
  - Access control based on auth mode

- **OAuth2 Authentication System**: Backend authentication support
  - Passport.js integration with Microsoft Azure AD and Google OAuth2
  - Session-based authentication with secure cookie handling
  - Auth middleware for protected routes
  - Support for `AUTH_MODE=none` and `AUTH_MODE=oauth2`
  - User management with admin role support

- **Bet Management Endpoints**: Enhanced bet control
  - Cash out endpoint with custom payout entry
  - Delete endpoint with force option for any bet status
  - Updated bet service with new operations

- **Background Job System**: Automated tasks
  - Odds sync job (configurable interval)
  - Bet settlement job (configurable interval)
  - node-cron for scheduled execution
  - Admin endpoints: `/api/admin/sync-odds`, `/api/admin/resolve-outcomes`
  - Jobs run asynchronously to prevent API timeouts

### Changed
- **Backend Dockerfile**: Enhanced for production security
  - Multi-stage build with builder and runtime stages
  - Non-root user (nodejs:1001) for security
  - dumb-init for proper signal handling
  - Custom entrypoint with secret loading logic
  - Health check endpoint for container orchestration

- **Database Schema**: New tables and fields
  - `SiteConfig` model with id (default 1), siteName, logoUrl, domainUrl
  - `User.isAdmin` boolean field for admin access control
  - `Game.period` and `Game.clock` fields for live tracking
  - Prisma client regenerated with updated types

- **API Response Format**: Improved data structure
  - Game objects include flattened `sportKey` and `sportName` fields
  - Maintains nested `sport` object for backward compatibility
  - Better frontend consumption patterns

### Security
- **Secret Management**: Production-grade security improvements
  - Secrets never logged or exposed in container images
  - File-based secrets with proper permissions (chmod 600)
  - Support for external secret stores (AWS, Azure, Kubernetes)
  - Clear separation between development (.env) and production (secrets) configs

### Technical
- **Configuration**: Enhanced environment variables
  - Updated `.env.example` with AUTH_MODE, SESSION_SECRET, OAuth credentials
  - Documented all authentication-related environment variables
  - Docker secrets configuration examples

---

## [0.1.0] - 2026-01-07

### Added
- **Initial Backend Release**: Node.js + Express + TypeScript + Prisma
  - Express.js REST API with TypeScript
  - Prisma ORM with PostgreSQL database
  - Winston logging with file/console transports
  - Rate limiting middleware
  - Error handling middleware

- **API Routes**: Core functionality
  - Games endpoint with timezone-aware filtering
  - Bets endpoint (create, read, update)
  - Admin endpoints (init-sports, sync-odds, resolve-outcomes, stats, health)
  - MCP integration endpoint

- **Services**: Business logic layer
  - Odds sync service with background processing
  - Bet service for bet management
  - Outcome resolver service for bet settlement
  - ESPN weather service integration

- **Database Schema**: Initial Prisma models
  - Sport, Team, Game models
  - CurrentOdds, OddsSnapshot for odds tracking
  - Bet, BetLeg models with status tracking
  - User model with authentication support

- **Scheduled Jobs**: Automated background tasks
  - Odds sync job (configurable interval)
  - Bet settlement job (configurable interval)
  - node-cron for scheduled execution

### Technical
- **Build System**: TypeScript compilation
  - tsc for production builds
  - tsx watch for development
  - Separate tsconfig for tests

- **Testing**: Basic test setup
  - Jest configuration
  - Test utilities and setup files
  - Example tests for services

- **Docker**: Containerization support
  - Development Dockerfile with hot reload
  - Production Dockerfile with multi-stage build
  - Docker Compose for local development
