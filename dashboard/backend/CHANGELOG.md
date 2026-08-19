# Backend Changelog

All notable changes to the Dashboard Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.6.0] - 2026-08-18

### Added

- **NBA, NCAAB, NHL and soccer team season stats syncs (issue #76)**: The four remaining `syncTeamSeasonStats` branches were `logger.warn` placeholders, so team stats stayed empty for half the supported leagues. All four now sync `/teams/statistics` as adapters on `BaseStatsService`, per issue #72's architecture.
  - `src/services/api-sports/base-stats.service.ts`: the `/teams/statistics` body moved into a protected `runTeamStatsSync`, parameterised by the target sport key and league params so a multi-league service can pick one league per call. Four new hooks carry the host differences: `teamStatsIdParam` (american-football and baseball query by `id`, the rest by `team`), `formatStatsSeason` (basketball labels seasons `"2024-2025"`), `mapTeamSeasonStats` (the payload → `TeamStats` mapping, defaulting to the existing american-football shape), and `findTeamForStats` (how the upstream team id resolves to a local `Team`). The response is now unwrapped tolerantly — `/teams/statistics` returns a bare object on most hosts where every other endpoint returns an array — and `toStatNumber` coerces the percentage and average strings API-Sports mixes in
  - `src/services/api-sports/basketball.service.ts` (new): `BasketballStatsService` collapses what NBA (league 12) and NCAAB (league 127) share on the basketball host — the year-pair season label (previously duplicated as `defaultTeamSeason` in both) and the `games`/`points` season-stats mapping. Points for/against split into the `offense`/`defense` columns, wins/losses/win% into `standings`
  - `src/services/api-sports/nhl.service.ts`: maps the hockey host's `games`/`goals` blocks. Overtime results stay in their own `overtimeWins`/`overtimeLosses` keys rather than being folded into the regulation record, since an overtime loss still earns a standings point
  - `src/services/api-sports/soccer.service.ts`: the league table is now a `Sport.key` → API-Football league id map (`LEAGUE_IDS_BY_SPORT_KEY`, covering EPL, La Liga, Serie A, Bundesliga, Ligue 1, MLS and the Champions League), read by both the live-games fan-out and the new `syncTeamStatsForLeague`. The service spans several sport keys and so has neither a `sportKey` nor a `leagueId` of its own — the caller names the league, and the resolved key is what lands in the `TeamStats.sportKey` column. Teams resolve by `externalId`, since soccer teams never come through `/teams` and carry no `apiSportsTeamId`. Draws map to `standings.ties`; clean sheets, failed-to-score, penalties and recent form come along
  - `src/services/stats-sync.service.ts`: `syncTeamSeasonStats` is a sport-key lookup plus a soccer branch rather than a nine-case switch. Sports with no team stats sync (MLB) still log the existing "not implemented" warning rather than writing empty rows from the default mapper
  - `tests/team-stats-sync.service.test.ts` (new): 17 tests driving the real dispatch down to the `TeamStats` write, against fixtures shaped like the actual basketball, hockey and API-Football responses — query param and season label per host, the full mapped payload per sport, soccer's sport-key → league table and `externalId` team resolution, and the unchanged NFL and MLB paths
  - Note: `syncTeamSeasonStats` still has no caller — no route and no job invokes it, so `team_stats` stays empty until one does. Tracked as issue #91; #76's premise that these run on a cron via `stats-sync.job.ts` was never true, that job only polls live games

### Fixed

- **CLV closing lines were never captured (issue #87)**: `CLVService.findMatchingOddsSnapshot` matched on `snapshot.outcome` / `price` / `point` / `timestamp` — four fields `OddsSnapshot` does not have. `outcome` was always `undefined`, so the matcher returned `null` for every leg, `betLeg.closingOdds` stayed null, `calculateCLV` returned null, and CLV reporting had no data for any bet ever placed. The matcher is now written against the real columns.
  - `src/services/clv.service.ts`: `findMatchingOddsSnapshot` is replaced by `findClosingLine` + `priceForSelection`. `OddsSnapshot` stores one row per bookmaker/market with a column pair per side, not one row per outcome, so the leg's `selection` (`home`/`away`/`over`/`under`) now picks the column rather than filtering rows: moneyline → `homePrice`/`awayPrice`, spread → `homeSpreadPrice`/`awaySpreadPrice` with the line checked against `homeSpread`/`awaySpread`, total → `overPrice`/`underPrice` against `totalLine`. Recency sorts on `capturedAt`, not the non-existent `timestamp`
  - `src/services/clv.service.ts`: snapshots are scanned newest-first rather than taking only the single newest row, so a partially-populated latest snapshot (one side priced, the other null) no longer loses the capture — the scan falls through to the next row that carries the price. A leg with a line still requires a snapshot at that same line (±0.1), since a price at a different number is not a comparable closing line
  - `src/services/clv.service.ts`: the scan prefers snapshots from the leg's own `bookmaker` (the column added for per-book CLV) and falls back to any book when that one has no usable row, so CLV compares a bet against the closing price at the book it was placed at where possible
  - `src/services/clv.service.ts`: `ClosingLineSnapshot` is now a `Pick<OddsSnapshot, ...>` of the columns the matcher reads instead of a hand-written interface, so a future schema drift fails `tsc` rather than silently matching nothing. The `as unknown as` cast at the call site is gone
  - `tests/clv.service.test.ts`: the `captureClosingLine` mocks previously returned `{ outcome, price, point, timestamp }` objects cast `as any` — a shape the database never produces — so the suite passed against a fictional schema. Snapshots are now built from a full `OddsSnapshot` row (typed against the Prisma model, so the fixture cannot drift from the real columns), covering moneyline home/away, spread side selection, line-moved-off-the-leg fallback, total over/under, market isolation, bookmaker preference and fallback, and the null-price fallback. All 8 new capture assertions fail against the previous implementation

---

## [0.5.0] - 2026-08-16

### Changed

- **Split the two oversized services — arbitrage and bet (issue #73)**: `arbitrage.service.ts` (1,096 lines) and `bet.service.ts` (1,030 lines) each became a thin entry point over a directory of single-responsibility modules. The public API is unchanged: `arbitrageService` / `betService`, the `ArbitrageService` / `BetService` classes, and every exported detection helper and type still resolve from the same two paths, so no route, job, controller or test import moved.
  - `src/services/arbitrage/` (new): `arbitrage.types.ts` (shared shapes), `arbitrage.config.ts` (env-derived thresholds, per-sport sigma tables), `arbitrage-calculator.service.ts` (stake split, stake plan, normal CDF, middle probability), `arbitrage-finder.service.ts` (pure detection over an odds snapshot, plus a new `detectAll` covering the five detectors the scanner runs), `arbitrage-alert.service.ts` (risk scoring, limit-risk estimate, notification), `arbitrage-scanner.service.ts` (the scan loop, drift query and persistence — the write path), `arbitrage-query.service.ts` (the reads behind `/api/analytics/arbitrage/*` and its MCP mirror)
  - `src/services/arbitrage.service.ts`: now 123 lines — the module map, the re-exports, and an `ArbitrageService` facade delegating to the scanner and query services. Largest remaining file in the family is 378 lines
  - `src/services/bet/` (new): `bet-crud.service.ts` (create/read/update/cancel/settle), `bet-analytics.service.ts` (`getStats` and the raw per-sport breakdown), `bet-validation.service.ts` (pre-placement rules, with the game-existence checks lifted into their own `validateGames`), `bet-odds.service.ts` (combined odds and payout, with the parlay and teaser branches split apart), `bet-formatter.ts` (the two Prisma include shapes, their derived payload types, and the response mapping)
  - `src/services/bet.service.ts`: now 77 lines — a `BetService` facade over the CRUD and analytics modules
  - The four inline copies of the bet `include` tree (create, list, get-by-id, and the post-create refetch) are now the two shared constants in `bet-formatter.ts`, which are also what the payload types are derived from
  - No behavioural change: `getHistory` keeps its narrower game selection (no `status`), `getStatsBySport` keeps its unused `_where` parameter, and the arbitrage risk/detection thresholds keep their existing values and env bindings

- **`BaseStatsService` — de-duplicated the seven API-Sports stats services (issue #72)**: The `src/services/api-sports/` family dropped from 2,948 lines to ~2,115 (with the shared code now covered by tests). `syncTeams`, `findTeam`, `getLiveGames`, quota accounting, status mapping, player upsert, and the game/team lookups each have one implementation instead of three to seven.
  - `src/services/api-sports/base-stats.service.ts` (new): abstract `BaseStatsService<TGame>` owning client construction, `getRequestsRemaining`/`hasSufficientQuota`, `getLiveGames`/`getLiveGameIds`, `syncTeams`, `syncTeamStats`, and the shared Prisma helpers (`findTeamByName`, `findTeamByApiId`, `resolveTeam`, `findGameByApiId`, `upsertGameStats`, `upsertPlayer`, `upsertPlayerGameStats`). Each sport supplies only `extractGameId`, `syncGameStats`, and whichever hooks it needs (`liveGameParams`, `teamsParams`, `mapApiTeam`, `filterApiTeams`, `defaultTeamSeason`, `resolveSeasonForDate`)
  - `src/services/api-sports/base-stats.service.ts`: `ScheduledStatsService<TGame>` adds the date-range walk (`syncGamesForDate`) for the three sports with a usable dated `/games` query (NFL, NCAAF, MLB), so the other four don't inherit an API they can't honour
  - `src/services/api-sports/american-football.service.ts` (new): `AmericanFootballStatsService` collapses what NFL (league 1) and NCAAF (league 2) share on the same host — the `/games` payload type, `getGamesByDate`, `upsertGameFromApi`, season labelling, and status mapping. Only `/games/statistics` differs between them, so `syncGameStats` stays per-sport
  - `src/services/api-sports/status.ts` (new): `mapApiStatusToLocal` (one table covering the football `Q1`–`Q4`/`HT`/`OT`, baseball inning-number, and generic `LIVE` short codes — they don't collide) and `resolveAmericanFootballSeason` (the Jan/Feb season-boundary rule), replacing three near-copies
  - `src/services/api-sports/client.ts`: exports `ApiSportsSport` and `ApiSportsResponse<T>`, retiring seven local re-declarations of the `{ response: T[] }` envelope
  - `src/services/stats-sync.service.ts`: `syncAllLiveStats` is one loop over `statsServices` rather than seven copy-pasted blocks; `syncAllTeams` is a `[service, season]` table rather than six copies of the same try/catch. `getLiveGames()` now returns raw payloads uniformly across all seven services (NFL/NBA/NHL/MLB previously returned `string[]`) — `getLiveGameIds()` covers the old shape
  - All seven services and `game-resolver.ts` now use the shared `prisma` from `config/database` instead of each constructing its own `PrismaClient` (eight connection pools → one)
  - `NHLStatsService`, `NBAStatsService`, `NCAABService` and `SoccerService` now pass `env.API_SPORTS_TIER` to `ApiSportsClient` like NFL/NCAAF/MLB already did, instead of silently using the `pro` default
  - `NCAABService` and `SoccerService` no longer export eagerly-constructed module singletons (they had no consumers, and would now throw at import time without an API key)
  - `tests/base-stats.service.test.ts` (new): 35 tests over the shared machinery — status mapping across all three short-code families, season boundaries, `getLiveGames` error containment, `syncTeams` create/update/filter/column-narrowing/unseeded-sport paths, `syncTeamStats` team resolution, `findGameByApiId` precedence, and `upsertPlayer`. This directory previously had none

- **TypeScript `any` reduction — top 6 offenders (issue #71)**: Replaced every explicit `any` annotation in the six heaviest files (63 by the issue's count, 75 by a broader match including `Record<string, any>`); repo-wide annotations dropped from 253 to 178. No behavioural change except the two fixes noted below.
  - `src/utils/error-message.ts` (new): `getErrorMessage(error: unknown)` helper, so `catch (error: any)` blocks reading `error.message` become `catch (error)` under `strict`'s `unknown` binding. Adopted by `admin.routes.ts` (18 blocks), `games.routes.ts` (4) and `sharp-indicator.service.ts` (1)
  - `src/routes/admin.routes.ts`: `Sport[]` for the init-sports accumulator; the sport-update P2025 check now narrows via `Prisma.PrismaClientKnownRequestError` instead of reading `.code` off `any`
  - `src/routes/stats.routes.ts`: `Prisma.GameStatsWhereInput` for the filter builders; new module-level `toStatsObject` / `readStatNumber` helpers read the free-form `GameStats.stats` JSON column defensively (non-numeric values now contribute 0 rather than string-concatenating into the total)
  - `src/routes/games.routes.ts`: `Prisma.GameWhereInput` / `CurrentOddsWhereInput` / `OddsSnapshotWhereInput` for the filter builders; new `BookmakerOdds` / `OddsMarket` / `OddsOutcome` interfaces describe the bookmaker card shape the frontend consumes
  - `src/services/clv.service.ts`: `Prisma.BetLegGetPayload` alias for the report queries; `Prisma.BetWhereInput` / `BetLegWhereInput` for the filter builders. `groupByField` now takes a selector function instead of a dotted path string, which removed the reflective `getNestedProperty` helper entirely
  - `src/services/sharp-indicator.service.ts`: `LineMovement[]` for the confidence-scoring inputs, `Prisma.SharpMoneyIndicatorGetPayload` for the read queries, and a `BookmakerLines` type plus `toBookmakerLines` / `parseLineValue` helpers for the `linesBefore` / `linesAfter` JSON columns
  - `src/services/api-sports/soccer.service.ts`: Local API-Football response interfaces (`ApiFootballResponse<T>`, `Fixture`, `TeamStatisticsEntry`, `FixturePlayersEntry`, `PlayerStatistics`) passed through `ApiSportsClient.get<T>()`, replacing the `(response as any).response` casts — matching the convention already used by `nba.service.ts` and `mlb.service.ts`
  - `src/services/stats-sync.service.ts`: `game.fixture?.id` in the soccer live-game loop, now that `getLiveGames()` returns `Fixture[]` rather than `any[]`

- **Dependency Management & Quality (issues #62-#63, #66, #68)**:
  - npm audit: Reduced vulnerabilities from 23 to 4; key upgrades: vitest 3.2.4→4.1.10, vite 6.4.3→8.2.1, react-router-dom 6.30.4→7.18.2, bcrypt to latest
  - Coverage thresholds ratchet: Established baseline coverage gates with {branches:34, functions:56, lines:52, statements:51}; configured Jest to enforce ratchet policy (only increase, never decrease)
  - Node.js runtime: Upgraded Docker images from node:20-alpine to node:22-alpine; updated package.json engines constraint to >=22.0.0
  - asyncHandler middleware: Created `/src/utils/async-handler.ts` utility for centralized async route error handling; created `/src/schemas/query-params.schema.ts` with Zod validation schemas; documented one-file-per-PR migration strategy in ASYNC-HANDLER-MIGRATION.md (to eliminate 63+ hand-rolled try/catch blocks across 17 route files)

### Added

- **asyncHandler Middleware Infrastructure (issue #68)**:
  - `/src/utils/async-handler.ts`: Express middleware wrapper for async route handlers; catches errors and passes to Express error middleware
  - `/src/schemas/query-params.schema.ts`: Reusable Zod schemas for query parameter validation (pagination, date ranges, sorting)
  - `ASYNC-HANDLER-MIGRATION.md`: Comprehensive migration guide with examples, priority order, and checklist for refactoring existing route handlers

### Fixed

- **NCAAB and Soccer team resolution compared an API-Sports id against `Team.externalId` (issue #72)**: `Team.externalId` holds The Odds API id, not the API-Sports one; NCAAB additionally compared a `number` to a `string`, so `isHome` was always `false` and every team's stats were written against `awayTeamId`. NCAAF already carried the corrected `apiSportsTeamId` comparison — folding the three into one base helper made the divergence visible. NCAAB now matches NCAAF; Soccer keeps its `externalId` match because soccer teams are not synced through `/teams` and carry no `apiSportsTeamId`
- **NCAAB and Soccer looked up games by `Game.externalId` only (issue #72)**: games reconciled by `upsertApiSportsGame` carry the upstream id in `apiSportsGameId`, so a reconciled NCAAB/Soccer game was never found and its stats were silently dropped. The shared `findGameByApiId` checks `apiSportsGameId` first and falls back to `externalId`, which is a superset of what every previous copy matched
- **`NFLStatsService.syncTeamStats` resolved the team by `Team.externalId` (issue #72)**: it was passed an API-Sports team id, which is stored in `apiSportsTeamId` — so the lookup never matched and NFL season stats were never written. The shared implementation keys on `apiSportsTeamId`, as NCAAF's copy already did
- **NBA player sync could attach stats to an arbitrary player (issue #72)**: `prisma.player.findFirst({ where: { externalId: undefined } })` drops the filter and returns the first player in the table, so an API-Sports player record with no id matched a random existing player. The shared `upsertPlayer` skips the lookup entirely when there is no external id. Same guard added to `findTeamByApiId`
- **`GET /api/games/:id/odds/history` returned 500 on every request** (found while typing `games.routes.ts` for issue #71): The where clause filtered on `timestamp`, a column `OddsSnapshot` does not have — the model stores `capturedAt`. Prisma rejects unknown arguments, so the endpoint threw `PrismaClientValidationError` for all callers. The `any`-typed where clause hid the mismatch from `tsc`. Now filters on `capturedAt`, matching the `orderBy` the query already used.

### Known Issues

- **`tsc --noEmit` does not pass clean**: 18 pre-existing errors across `src/jobs/*` from the node-cron upgrade — `scheduled` and `runOnInit` are no longer members of `TaskOptions`, and the `cron` namespace is no longer importable for return-type annotations. Present before and after the issue #71 typing work; unrelated to it.
- **CLV closing-line capture never matches** (issue #87): `CLVService.findMatchingOddsSnapshot` reads `outcome` / `price` / `point` / `timestamp` off `OddsSnapshot` rows, none of which exist on that model, so `betLeg.closingOdds` is never populated and CLV is never computed. Surfaced by the issue #71 typing work and documented in a `ClosingLineSnapshot` interface comment; behaviour deliberately left unchanged pending a fix, since correcting the matcher changes settlement data.

---

## [0.4.3] - 2026-08-16

---

## [0.4.2] - 2026-08-15

### Added

- **Bet Correlation Analysis** (Phase 3, issue #10): Detects correlation between the legs of a parlay, computes a correlation-adjusted true-odds figure, and finds pre-game hedging opportunities.
  - `prisma/schema.prisma`: New `BetLegCorrelation` (`bet_leg_correlations`) and `ParlayAnalysis` (`parlay_analyses`) models with `BetLeg`/`Bet`/`User` back-relations. Migration `20260815120000_add_bet_correlation_analysis`.
  - `src/services/correlation.service.ts`: `correlationService` singleton with `analyzeCorrelation`, `analyzeParlay`, `analyzeDraftSlip`, `calculateTrueOdds`, `findHedgingOpportunities`, plus exported pure detectors `detectSameGameCorrelation`, `detectDerivativeCorrelation`, `detectInverseCorrelation`, `detectTemporalCorrelation`.
  - Detection covers `moneyline`/`spread`/`total` legs: same-game (spread+total, score 0.85), derivative (moneyline+spread same side with `|line| <= 3`, score 0.90), inverse (opposite moneylines, score -1.0, hard-blocked), and temporal (same team within 48h across two games, score 0.40). Pairs sharing an existing `sgpGroupId` are reported as priced/expected correlation rather than a mistake flag.
  - `calculateTrueOdds` layers a correlation penalty on top of `calculateParlayOdds` from `src/utils/odds-calculator.ts` — up to -30% decimal odds for positive correlation, up to +20% for inverse.
  - `src/routes/analytics-correlation.routes.ts`: `POST /api/analytics/correlation/analyze|parlay|hedge`, `GET /api/analytics/correlation/history|education`.
  - `findHedgingOpportunities` sources opposite-side prices from `CurrentOdds` (pre-game only — no in-play odds feed today, so live hedging is out of scope for v1).
  - Player-prop correlation is out of scope for v1 — blocked on the (unbuilt) Player Props feature; the `SelectionType` enum has no player-prop legs yet.
  - Security: `analyzeLegPair` and `findHedgingOpportunities` accept an optional `userId` and, when provided (OAuth mode), require the requested bet leg(s)' parent bet to belong to that user via a new `assertLegsOwnedBy` check — otherwise a "not found" error is thrown, identical to the missing-leg case, so existence isn't leaked. `analytics-correlation.routes.ts` now passes `getScopedUserId(req)` through on `/analyze` and `/hedge`.
  - Tests: `tests/correlation.service.test.ts` (38, incl. ownership enforcement) and `tests/analytics-correlation.routes.test.ts` (14).

---

## [0.4.1] - 2026-08-15

### Added

- **Arbitrage & Middle Detection** (Phase 3, issue #9): Detects guaranteed-profit arbitrage across bookmakers and middle opportunities where both legs can win.
  - `prisma/schema.prisma`: New `ArbitrageOpportunity` model (`arbitrage_opportunities`) with `Game` and `User` back-relations, plus middle window and risk-factor columns. Migration `20260815000001_add_arbitrage_opportunities`.
  - `src/services/arbitrage.service.ts`: `ArbitrageService` singleton with `scanForArbitrage`, `expireStaleOpportunities`, `markTaken`, `getLiveOpportunities`, `getHistory`, `getStats`, plus pure helpers `calculateOptimalStakes`, `buildStakePlan`, `detectTwoWayArbitrage`, `detectMiddle`, `estimateMiddleProbability` and `assessRisk`.
  - Detection is line-aware: spreads require `homeSpread + awaySpread >= 0` and totals require `overLine <= underLine`, so books quoting different lines no longer produce false arbitrage. A strictly positive gap is reported as a middle with a modelled hit probability.
  - `src/events/odds-sync.events.ts`: New `odds-sync:completed` event emitted by `sync-odds.job`, so downstream analytics react to fresh odds instead of polling blind.
  - `src/jobs/arbitrage-scan.job.ts`: Scans immediately after each odds sync; a 30-second cron pass expires stale opportunities and re-scans only when a sync notification was missed.
  - `src/routes/analytics-arbitrage.routes.ts`: `GET /api/analytics/arbitrage/live|history|stats|:id`, `POST /api/analytics/arbitrage/calculator` and `POST /api/analytics/arbitrage/:id/take`.
  - Risk assessment covers snapshot staleness (>5 min), odds drift (>5%), suspiciously high profit (>10%), proximity to start (<15 min) and bookmaker account-limit exposure.
  - New env vars: `ARBITRAGE_SCAN_ENABLED`, `ARBITRAGE_SCAN_CRON`, `ARBITRAGE_MIN_PROFIT_PCT`, `ARBITRAGE_DEFAULT_STAKE`, `ARBITRAGE_TTL_SECONDS`, `ARBITRAGE_MIN_MIDDLE_PROBABILITY`.
  - Tests: `tests/arbitrage.service.test.ts` (46) and `tests/analytics-arbitrage.routes.test.ts` (16).
  - Sync-cadence decision: odds sync stays at ~10 minutes; freshness is disclosed via `oddsSnapshotAge` rather than paid down with extra API calls. See ADR-019.

---

## [0.4.0] - 2026-08-15

### Added

- **Team Sync — All Sports** (`POST /api/admin/sync-teams`): Added `syncTeams()` to every sport service (NFL, NBA, NHL, NCAAB) and created `MLBStatsService` with `syncTeams()`. Added `syncAllTeams()` to `StatsSyncService` and a new admin endpoint `POST /api/admin/sync-teams` that runs team sync in the background. Syncs 153 teams total (NFL 34, NBA 34, NHL 32, NCAAB 23, MLB 30) via api-sports.io.
  - `src/services/api-sports/nfl.service.ts`: Added `syncTeams(season)` using league ID 1, integer season (default `currentYear - 2`).
  - `src/services/api-sports/nba.service.ts`: Added `syncTeams(season)` using league ID 12, `"YYYY-YYYY"` season format.
  - `src/services/api-sports/nhl.service.ts`: Added `syncTeams(season)` using league ID 57, integer season.
  - `src/services/api-sports/ncaab.service.ts`: Added `syncTeams(season)` using league ID 127, `"YYYY-YYYY"` season format.
  - `src/services/api-sports/mlb.service.ts`: New `MLBStatsService` with `getLiveGames()`, `syncGameStats()`, and `syncTeams()` (league ID 1, `v1.baseball.api-sports.io`). Filters out "American League"/"National League" conference entries.
  - `src/services/api-sports/client.ts`: Added `'baseball'` to `ApiSportsConfig.sport` union and `BASE_URLS` map pointing to `https://v1.baseball.api-sports.io`.
  - `src/services/stats-sync.service.ts`: Added `MLBStatsService`, MLB block in `syncAllLiveStats()`, and new `syncAllTeams()` method.
  - `src/routes/admin.routes.ts`: New `POST /sync-teams` route calling `statsSyncService.syncAllTeams()` in background.
- **Docker: Persistent Prisma Client** (`Dockerfile.dev`): Updated dev container startup CMD to run `npx prisma generate && npx prisma migrate deploy` before `npm run dev`. Prevents stale Prisma client errors when the named `backend_node_modules` Docker volume shadows image layers and new models (e.g., `SharpMoneyIndicator`, `BookmakerAnalytics`) are missing from the generated client after schema migrations.

- **Market Consensus & Deviations — Phase 2**: Expanded market consensus analytics with richer consensus and dispersion metrics plus explicit best-value fields for bookmaker outlier workflows.
  - `prisma/schema.prisma`: Enhanced `MarketConsensus` model with `consensusPrice`, `medianLine`, `meanLine`, `modeLine`, `range`, `interquartileRange`, `bestValueSide`, `bestValueBookmaker`, `bestValueLine`, `sharpBookWeight`, and a `marketType` index.
  - `prisma/migrations/20260514000001_enhance_market_consensus_phase2/migration.sql`: Adds/backfills new `market_consensus` columns and creates an index on `market_type`.
  - `src/services/market-consensus.service.ts`: `calculateConsensus()` now computes additional phase-2 market-truth metrics and persists them; added `identifyOutliers(gameId)` for per-market outlier discovery.
  - `tests/market-consensus.service.test.ts`: New unit tests covering phase-2 spreads consensus calculations and outlier identification behavior.
- **Bookmaker Performance Analytics — Phase 2** (Issue: Bookmaker Analytics): Added persistent bookmaker analytics models and service calculations for value, sharpness, and reliability ranking.
  - `prisma/schema.prisma`: Added `BookmakerAnalytics` and `BookmakerMovementEvent` models; linked movement events to `Game`.
  - `prisma/migrations/20260514000002_add_bookmaker_analytics_phase2/migration.sql`: Creates `bookmaker_analytics` and `bookmaker_movement_events` tables, indexes, and FK constraints.
  - `src/services/bookmaker-analytics.service.ts`: New `BookmakerAnalyticsService` with `calculateBookmakerMetrics(bookmaker)` and `rankBookmakers(criteria)` methods.
  - `tests/bookmaker-analytics.service.test.ts`: Added unit tests for metric calculation/upsert behavior and criteria-based ranking.
- **Bookmaker Analytics — Phase 2 Closeout** (Option C):
  - `prisma/schema.prisma`: Made `averageCLVOffered`, `uptimePercentage`, `recommendationScore` nullable in `BookmakerAnalytics`; added `bookmaker` (`VARCHAR(50)`) and index to `BetLeg`.
  - `prisma/migrations/20260520033152_bookmaker_analytics_nullable_metrics`: Drops NOT NULL on 3 `bookmaker_analytics` columns.
  - `prisma/migrations/20260520033943_add_betleg_bookmaker`: Adds `bookmaker` column and `bet_legs_bookmaker_idx` index.
  - `src/services/bookmaker-analytics.service.ts`: `averageCLVOffered` now computed from `BetLeg.aggregate` (null when no CLV rows exist); `uptimePercentage` remains null (no source); `recommendationScore` null when inputs missing; added `runBatchCalculation()`.
  - `src/jobs/bookmaker-analytics.job.ts`: New daily cron (02:00 UTC) with staleness guard — runs immediately on startup if table is empty or >48 h stale.
  - `src/server.ts`: Registers `startBookmakerAnalyticsJob()` at startup.
  - `src/routes/analytics-bookmaker.routes.ts`: Fully rewritten — `/:bookmaker` reads persisted row (404 if not yet computed); added `/sharp`, `/compare`, `/best-value/:sport`, `/movement/:bookmaker` endpoints.
  - `src/routes/bets.routes.ts`: Added optional `bookmaker` field (max 50 chars) to `createBetLegSchema`.
  - `src/services/clv.service.ts`: `groupByBookmaker()` now prefers `leg.bookmaker` field over name-extraction heuristic for legacy rows.
  - `docs/api/openapi-internal.yaml`: Added all 7 `/api/analytics/bookmakers/*` endpoint definitions and `BookmakerAnalytics` schema.
  - `tests/bookmaker-analytics.service.test.ts`: Updated mocks for DB-scoped consensus query; added `betLeg.aggregate` mock.
  - `tests/analytics-bookmaker.routes.test.ts`: New — 15 integration tests for all 7 endpoints including 404 path.
  - `tests/jobs/bookmaker-analytics.job.test.ts`: New — 3 smoke tests for batch processing and error isolation.
- **Football (NFL/NCAAF) Hourly Sync — Pre-Season Readiness**: Added an NFL/NCAAF backfill/window sync job mirroring the existing MLB hourly job, plus completed NCAAF team stats support that was previously a TODO stub.
  - `src/jobs/football-hourly-sync.job.ts`: New hourly cron (`FOOTBALL_SYNC_CRON`) syncing both NFL and NCAAF over a rolling window (`FOOTBALL_SYNC_HOURS_BACK`/`_FORWARD`, default 96h back / 72h forward — wider than MLB's to survive a missed Thu–Mon slate), with the same re-entrancy guard, quota-pause, and status-reporting pattern as `mlb-hourly-sync.job.ts`.
  - `src/services/api-sports/nfl.service.ts` / `ncaaf.service.ts`: Added `getGamesByDate()` and `syncGamesForDate()` for date-range backfill (previously only live-game polling existed).
  - `src/services/api-sports/ncaaf.service.ts`: Added `syncTeams()` (no NCAAF teams were ever being synced, so team stats had nothing to attach to) and implemented `syncTeamStats()`.
  - `src/services/stats-sync.service.ts`: Added `syncFootballHourlyWindow()`/`syncFootballDateRange()`; wired `ncaafService.syncTeamStats()` into the `syncTeamSeasonStats()` switch (was `logger.warn('NCAAF team stats sync not yet implemented')`); added NCAAF to `syncAllTeams()`.
  - `src/routes/admin.routes.ts`: New `POST /sync-football-hourly-window` and `GET /football-sync-status` endpoints, mirroring the MLB admin routes.
  - `src/config/env.ts`, `.env.example`: Added `FOOTBALL_SYNC_CRON`, `FOOTBALL_SYNC_HOURS_BACK`, `FOOTBALL_SYNC_HOURS_FORWARD`.
  - `src/server.ts`: Registers `startFootballHourlySyncJob()` at startup.
  - `tests/jobs/football-hourly-sync.job.test.ts`, `tests/jobs/mlb-hourly-sync.job.test.ts`: New — re-entrancy guard, success/error/quota-pause status reporting (MLB's hourly job previously had zero test coverage).
  - `tests/admin.routes.test.ts`: Added coverage for the MLB and football sync/status admin endpoints (previously untested) and the corrected `init-sports` sport count.

### Fixed

- **Duplicate `Game` rows from API-Sports stats sync (MLB, NFL, NCAAF)**: `Game.externalId` holds The Odds API's event ID, but the MLB stats sync was upserting games keyed on API-Sports' own numeric game ID — a different ID space — so its upsert never matched the odds-sourced row and silently created a second, orphaned `Game` row instead. Bet settlement was unaffected (it resolves scores from ESPN independently), but the enriched live-stats sync was largely writing to rows no bet or odds was ever attached to, and `GET /games` had no dedup against the duplicates.
  - `src/services/api-sports/game-resolver.ts`: New shared helper — matches an incoming API-Sports game to the existing odds-sourced `Game` row by sport + team names + a 12h kickoff-time window (mirroring `OutcomeResolverService`'s ESPN team-name matching), updating it in place; falls back to a standalone row only when no odds-sourced match exists.
  - `src/services/api-sports/mlb.service.ts`, `nfl.service.ts`, `ncaaf.service.ts`: `upsertGameFromApi()` now goes through `game-resolver.ts`; `syncGameStats()`/`syncGameStatsFromGame()` game lookups switched from `externalId` to the `apiSportsGameId` column so they find the row the resolver just updated.
- **NCAAF league ID**: was hardcoded to `1` (NFL's ID); confirmed against the live API-Sports `/leagues` endpoint that NCAA is league `2`. NCAAF was very likely syncing NFL data (or nothing) previously.
- **NFL/NCAAF season-year boundary**: `getLiveGames()`/date lookups used the raw calendar year, mislabeling any game played after the new year (e.g. a Jan 2027 playoff game belongs to the "2026" season). Added a shared Jan/Feb rollback rule in both services.
- **NCAAF live-poll game ID**: `stats-sync.service.ts`'s live-game loop read `game.id` on API-Sports game objects, but the ID is nested at `game.game.id` — every live NCAAF game was being synced under the literal string `"undefined"`.
- **NCAAF team/game matching**: `syncGameStats()` compared API team IDs against `Team.externalId` (a generic, largely-unused field) instead of `Team.apiSportsTeamId`, and `syncPlayerStats()`'s team lookup had a type mismatch (`externalId` is a string column, compared against a raw number) that meant it could never match — both could silently misattribute or drop stats.
- **`admin.routes.ts` `/init-sports`**: its own duplicate sports list was missing `americanfootball_ncaaf` entirely (the canonical list in `src/scripts/init-sports.ts` had it) — running sport init via this endpoint instead of the script would silently block all NCAAF syncing.
- **`api-sports/client.ts` rate limiter**: `API_SPORTS_TIER` was defined in env config but never actually read — the limiter was hardcoded to Pro-tier (5 req/s) regardless of subscription. Now tier-aware (free/pro/ultra/mega).
- **`api-sports/client.ts` 429 retry**: retried on rate-limit responses with no maximum attempt count, so sustained rate-limiting could retry indefinitely. Capped at 3 attempts.
- Added `americanfootball_ncaaf` to the outdoor-weather sport lists in `espn-weather.service.ts` and `odds-sync.service.ts` (college football weather affects totals the same way NFL's does).

---

## [0.3.10] - 2026-05-14

### Added
- **`prisma/migrations/20260513000002_add_admin_settings_table`**: Creates the `admin_settings` table that the `AdminSettings` Prisma model maps to. The model and its `prisma.adminSettings.upsert` calls in `/api/admin/settings` and `getAdviceContext` were already present but the corresponding `CREATE TABLE` migration was missing, causing runtime "table does not exist" errors on freshly migrated databases.

### Fixed
- **`package.json` `build` script**: Changed from `tsc` to `prisma generate && tsc` so the Prisma client is always regenerated before TypeScript compilation. Prevents stale-client `TS2339` errors (e.g. `Property 'sharpMoneyIndicator' does not exist`) when the schema has been updated but `prisma generate` has not been run manually.

---

## [0.3.8] - 2026-05-13

### Added

- **Sharp vs Public Money Indicators — Phase 2** (Issue #8): Detects and stores indicators showing which side professional ("sharp") bettors are backing vs. recreational ("public") money. A scheduled job runs every 15 minutes, derives sharp-side signals from existing line movement data, and persists confidence-rated indicators.
  - `prisma/schema.prisma`: New `SharpMoneyIndicator` model (`sharp_money_indicators` table) storing `lineMovement`, `sharpSide`, `publicSide`, `sharpConfidence` (1-10), `contraindicators`, and optional `publicBettingPct`/`publicMoneyPct` fields. Linked to `Game` via `gameId`. Migration: `20260513000001_add_sharp_money_indicators`.
  - `src/services/sharp-indicator.service.ts`: `SharpIndicatorService` with `detectSharpSide()` (analyses steam/reverse/gradual line movements per game+market, votes on direction), `calculateConfidence()` (scores 1-10 from steam count, bookmaker coverage, recency, consistency), `findContrarianOpportunities()` (returns scheduled games where sharp money opposes the crowd with `sharpConfidence ≥ threshold`), `getLatestIndicators()`, `getIndicatorsForGame()`, and `getStats()`.
  - `src/routes/analytics-sharp.routes.ts`: Four authenticated REST endpoints under `/api/analytics/sharp`: `GET /live` (current indicators), `GET /game/:gameId` (per-game breakdown), `GET /contrarian` (fade-the-public opportunities), `GET /stats` (summary counts / avg confidence).
  - `src/jobs/sharp-indicator.job.ts`: `startSharpIndicatorJob()` cron (every 15 min, `America/New_York`) with immediate startup run, idle-guard, and status helpers.
  - `src/routes/index.ts`: Mounted `/analytics/sharp` router.
  - `src/server.ts`: `startSharpIndicatorJob()` called alongside existing scheduled jobs.

---

## [0.3.7] - 2026-05-12

### Added
- **5 new `/api/mcp/*` routes** for full MCP tool coverage:
  - `GET /api/mcp/games` — lists upcoming games (up to 50), used by `get_active_games` tool
  - `GET /api/mcp/bets` — lists user's bets with optional `status` filter, scoped to `userId`
  - `GET /api/mcp/bets/:id` — fetches a single bet by ID, scoped to `userId`
  - `GET /api/mcp/games/:id/odds` — returns current odds snapshot for a game
  - `GET /api/mcp/teams/search?q=` — searches teams by name using `ILIKE`, returns `{id, name, abbreviation, sport, logoUrl}`
- **`AdminSettings` Prisma model** (`prisma/schema.prisma`): Singleton row (`id = 'singleton'`) storing configurable risk thresholds — `riskHighThreshold` (default 1000), `riskModerateThreshold` (default 500), `winRateLow` (default 45), `winRateHigh` (default 55). Persisted to `admin_settings` table.
- **`GET /api/admin/settings`** — returns (or upserts with defaults) the `AdminSettings` singleton.
- **`PATCH /api/admin/settings`** — updates one or more risk thresholds; all fields optional, validated with Zod.
- **MCP controller tests** (`tests/mcp.controller.test.ts`): 12 new tests covering multi-tenant isolation, permission enforcement (403 for missing permissions), Zod validation errors (invalid odds, missing `game_id`, non-UUID), date-window correctness for `getGamesWithExposure`, and `userId` attribution on `quickCreateBet`.
- **`get_advice_context` and `get_games_with_exposure` controller handlers**: `getAdviceContext` accepts `?limit=` (default 100) and returns pending bets, recent results, stats, and risk analysis. `getGamesWithExposure` accepts `?sport=` and `?only_with_bets=` filters.

### Changed
- **Permission enforcement on all MCP routes** (`src/routes/mcp.routes.ts`): `requirePermission` now applied to every route — `'bets'` for bet reads, `'write'` + `'bets'` for `quick-create`, `'stats'` for summary and advice-context.
- **`userId` threaded through all MCP controller handlers** (`src/controllers/mcp.controller.ts`): Every handler now extracts `const userId = req.apiKey?.userId ?? undefined` and passes it to all `betService.*` calls and Prisma queries, preventing cross-user data leakage.
- **Date window fix in `getGamesWithExposure`**: Replaced `new Date()` (current moment) with midnight-anchored `todayStart` / `tomorrowStart` so games earlier in the same calendar day are correctly included.
- **`limit` param added to `getActiveBets` and `getAdviceContext`** (default 100): Prevents unbounded Prisma queries returning thousands of rows.
- **American odds validation in `quickCreateBetSchema`**: `odds` field now requires `Math.abs(o) >= 100`; rejects values like `50` that are not valid American odds format.
- **Dead validation block removed from `quickCreateBet` controller**: Manual `Missing required fields` check removed — Zod schema already enforces all required fields before the handler runs.
- **`any` types replaced in MCP controller helpers**: `formatBetForAdvice`, `analyzeRisk`, and `generateBetName` now use `BetResponse`, `BetLegResponse`, and `BetStats` types from `bet.types`.
- **`analyzeRisk` reads thresholds from `AdminSettings`**: Thresholds sourced from `prisma.adminSettings.upsert` instead of hardcoded `$1000` / `$500` / `45%` / `55%` literals.
- **All MCP controller responses standardized to `{status: 'success', data: {...}}`**: Error responses use `{status: 'error', error: ...}`.
- **Parlay decimal odds guard in `ai-bets.routes.ts`**: Added `isFinite(rawTotalDecimalOdds) && rawTotalDecimalOdds > 1.0` check before conversion to American odds; returns `400` with descriptive error instead of producing `NaN` or `Infinity`.

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
