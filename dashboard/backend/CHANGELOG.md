# Backend Changelog

All notable changes to the Dashboard Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **TypeScript Build Errors**: Resolved 42 compilation errors in API-Sports services (Issue #13)
  - Fixed response type assertions from `unknown` to `any` in all services
  - Removed `homeScore`/`awayScore` fields from GameStats operations (not in schema)
  - Updated Player model usage to use `firstName`/`lastName` instead of `name` field
  - Added `teamId` field to all PlayerGameStats create operations (required field)
  - Added null safety checks for `game.homeTeam` and other optional relations
  - Fixed NHL period score handling (undefined → null type coercion)
  - Changed `game.sport` to `game.sportId` in Soccer service
  - Removed invalid `externalId_sport` composite unique constraint from Player upserts
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
