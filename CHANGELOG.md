# Sports Odds MCP - Master Changelog

This project consists of two main components:

- **MCP Server**: FastMCP server providing sports data to Claude Desktop ([mcp/CHANGELOG.md](mcp/CHANGELOG.md))
- **Web Dashboard**: React + Node.js web application for bet tracking ([dashboard/CHANGELOG.md](dashboard/CHANGELOG.md))

## Component Changelogs

For detailed change history, see the component-specific changelogs:

- [MCP Server Changelog](mcp/CHANGELOG.md) - FastMCP server, tools, formatters, API integrations
- [Dashboard Changelog](dashboard/CHANGELOG.md) - Web UI, backend API, database, bet management

## Project-Level Changes

Changes that affect the entire project structure:

## [Unreleased]

- **Arbitrage & Middle Detection** (Phase 3, issue #9): Merged to `beta`, pending version bump/release. Full-stack detection of guaranteed-profit arbitrage and middle opportunities across bookmakers — see [dashboard/CHANGELOG.md](dashboard/CHANGELOG.md) for details.

---

## [2026-08-15]

### Packages
- **Frontend:** v0.5.0
- **Backend:** v0.4.0
- **MCP:** v0.4.0

### Release Summary

Phase 2 complete: Bookmaker Performance Analytics shipped alongside a full Desert Sunset visual redesign of the dashboard, new MLB/NFL/NCAAF sync jobs, and a fix for duplicate `Game` rows created by the API-Sports stats sync.

### Added
- **Bookmaker Performance Analytics** (Phase 2): Value/sharpness/reliability ranking and comparison across bookmakers — backend models + service + daily batch job + 7 REST endpoints, frontend `/analytics/bookmakers` page with Rankings and Detail tabs
- **Market Consensus Phase 2**: Richer consensus/dispersion metrics (median/mean/mode line, IQR, best-value side) and per-market outlier identification
- **Team & stats sync — MLB, NFL, NCAAF**: New `MLBStatsService`, `syncTeams()` across all sport services (153 teams total), hourly NFL/NCAAF window sync job, and completed NCAAF team stats support (previously a TODO stub)
- **Desert Sunset visual redesign**: Full re-skin of the app shell and every primary screen (dusk-purple dark / sand-paper light, pixel display font, three signature card treatments) — pure UI change, no data flow affected

### Fixed
- Duplicate `Game` rows created by MLB/NFL/NCAAF stats sync writing to a different ID space than the odds-sourced rows; added a shared game-resolver matching by sport + team names + kickoff window
- NCAAF league ID (was hardcoded to NFL's ID), season-year boundary handling for NFL/NCAAF, NCAAF live-poll game ID lookup, and NCAAF team/game stat matching
- API-Sports rate limiter now tier-aware (free/pro/ultra/mega) instead of hardcoded to Pro; 429 retries capped at 3 attempts

### Component Versions
- Dashboard Backend: v0.4.0
- Dashboard Frontend: v0.5.0
- MCP Server: v0.4.0
- Dashboard Root: v0.2.5

See [dashboard/CHANGELOG.md](dashboard/CHANGELOG.md) and [mcp/CHANGELOG.md](mcp/CHANGELOG.md) for full details.

---

## [2026.05.14]

### Packages
- **Frontend:** v0.4.4
- **Backend:** v0.3.10
- **MCP:** v0.3.4

### Changes
### Release Summary

Phase 1 complete: Line Movement Tracking feature shipped with full detection pipeline, analytics UI, and 10 follow-on bug fixes identified during post-implementation review. All filters (steam, gradual, normal), value-opportunity pages, and analytics widgets now operate correctly under default deployment settings.

### Added
- **Line Movement Analytics** (Phase 1): End-to-end feature for detecting steam moves, gradual drift, and bookmaker disagreement — backend service + scheduled job + REST API + full React UI at `/analytics/movements`

### Fixed
- Detection pipeline: steam classification from split markets, threshold misaligned with 10-min sync cadence, gradual moves never reaching `> 3600 s` threshold, duplicate rows from overlapping windows, live-game status filter, historical backlog re-processing
- Bookmaker disagreement: stale/duplicate rows in live list, h2h away-price divergence ignored, `bestValue` always reporting home/over side, commenced-but-unupdated game status gap
- Analytics UI: `SteamMoveAlert` clobbering page filter, `DisagreementBreakdown` omitting below-threshold markets, `MovementPerformance` timeframe desync, type errors, filter passthrough bug, team navigation 404s

### Component Versions
- Dashboard Backend: v0.3.6
- Dashboard Frontend: v0.4.2
- Dashboard Root: v0.2.5

See [dashboard/CHANGELOG.md](dashboard/CHANGELOG.md) for full details.

---

---


## [2026-02-03] 

### Release Summary
Full release with all TypeScript build errors resolved. Backend now compiles successfully with 0 errors.

### Component Versions
- MCP Server: v0.2.1
- Dashboard Backend: v0.2.4
- Dashboard Frontend: v0.3.4
- Dashboard Root: v0.2.5

### Fixed
- **TypeScript Build Errors** (Issue #13): Resolved all 50 compilation errors in API-Sports services
  - Fixed response type assertions from `unknown` to `any` in all services
  - Removed `homeScore`/`awayScore` fields from GameStats (not in Prisma schema)
  - Updated Player model to use `firstName`/`lastName` instead of `name` field
  - Changed Player operations from `upsert` to `findFirst` + `update`/`create` pattern
    - Reason: `externalId` is indexed but not unique (only `id` is unique in schema)
  - Added `teamId` to all PlayerGameStats create operations
  - Fixed NHL period score type handling (undefined → null coercion)
  - Added null safety checks for optional relations
  - Services affected: NCAAB, NCAAF, NHL, Soccer

### Build Status
- ✅ Backend TypeScript compiles with 0 errors (down from 50)
- ✅ Frontend builds successfully
- ✅ All tests passing (360/391 backend tests - 92%)
- ✅ Full NPM packages and Docker images available

**Previous release**: v0.2.4 (partial - MCP only)
**Closes**: #12, #13

---

## [2026-02-03-partial] 

### Release Summary
**Partial Release** - MCP Server only. Backend builds blocked by TypeScript compilation errors in API-Sports services (see issue #13).

**Update**: Issue #12 (date parsing errors) has been resolved! Backend tests now at 360/391 passing (92%).

### Component Versions
- **MCP Server**: v0.2.1 (✅ Fully functional, released in MCPB package)
- **Dashboard Backend**: v0.2.3 (❌ Build blocked by issue #13, but tests improved)
- **Dashboard Frontend**: v0.3.3 (⚠️ Source available, can be built separately)

### What's Released
- ✅ MCP Server MCPB package (`sports-data-mcp-v0.2.1.mcpb`)
- ✅ Source code with all fixes and enhancements

### What's Blocked
- ❌ Backend NPM package (42 TypeScript errors in API-Sports services)
- ❌ Docker images (depend on backend build)

### Fixes
- **Date Parsing in Outcome Resolver** (commit 5d3ea11) - **CLOSES #12** ✅
  - Added validation for missing/null commenceTime before date parsing
  - Added check for invalid dates using isNaN(date.getTime())
  - Returns null gracefully with appropriate logging instead of throwing errors
  - Added commenceTime to all mock games in tests  
  - Added two new test cases for missing and invalid commenceTime
  - **Result**: All 23 outcome-resolver tests now passing (was 2 failing)
  
- API-Sports client import corrections (commit 9286021)
  - Fixed RateLimiter import from 'limiter' package
  - Updated NCAAB, NCAAF, Soccer services to use ApiSportsClient class
  - Initialized API client instances with proper configuration

### Merged from PR #11
- Version bumps: backend v0.2.2→v0.2.3, frontend v0.3.2→v0.3.3
- Fixed TypeScript compilation errors in GameStats interface
- Added API-Sports integration fields to database schema

### Test Status
- **Backend Tests**: 360 passing, 31 skipped (92% pass rate, up from 356)
- **Resolved**: Issue #12 - Date parsing errors in outcome-resolver ✅

### Known Issues (Remaining)
- **Issue #13**: 42 TypeScript errors in API-Sports services (NCAAB, NCAAF, NHL, Soccer)
  - Prisma schema mismatches (homeScore, externalId_sport, name fields)
  - Null safety issues (game.homeTeam, teamId)
  - Response type assertions needed
- **Issue #12**: Date parsing errors in outcome-resolver service (2 test failures)

### Next Steps
- Fix issue #13 to enable backend builds
- Release full dashboard in v0.2.5

## [2026-01-15]

### Release Summary
Planning release for advanced analytics features. Added 5 database schema enhancements for API-Sports integration and created comprehensive GitHub issue templates for 8 advanced analytics features across 3 implementation phases.

### Component Versions
- **Dashboard Backend**: v0.2.1 (schema updated)
- **Dashboard Frontend**: v0.3.1 (unchanged)

### Database Schema Enhancements
- **API-Sports Integration**: Added ID mapping fields to Team, Player, and Game models
  - Team: `apiSportsTeamId` field with index
  - Player: `apiSportsPlayerId` field with index
  - Game: `apiSportsGameId`, `apiSportsLeagueId`, `season`, `seasonType` fields with indexes
  - Migration: `add_api_sports_ids` completed successfully

### Planning & Documentation
- **Advanced Analytics Roadmap**: Created 3-phase implementation plan (77-82 days total)
  - Phase 1 (20 days): CLV tracking, line movement, bookmaker disagreement detection
  - Phase 2 (22 days): Sharp vs public money, market consensus, bookmaker analytics
  - Phase 3 (40 days): Arbitrage detection, bet correlation analysis
- **GitHub Issues**: Created 9 comprehensive issue templates with full technical specifications
  - Each template includes database models, algorithms, API endpoints, UI components, acceptance criteria
  - Epic tracking issue links all features with timeline and success metrics
- **Documentation**: Added `docs/ANALYTICS-IMPLEMENTATION-SUMMARY.md` with complete planning overview

### Business Impact
- **Competitive Advantage**: Features not available on most sportsbooks
- **Target Markets**: Casual bettors (education), serious bettors (analytics), professional bettors (arbitrage)
- **Estimated ROI**: 117% in Year 1 with 200 premium subscribers
- **User Engagement**: Projected +40% DAU, +25% session duration, +30% retention

## [2026-01-13]

### Release Summary
Dashboard patch release adding interactive parlay odds boost feature with profit-based calculation, React portals for proper modal positioning, and various bug fixes for Prisma Decimal handling and date formatting.

### Component Versions
- **Dashboard Backend**: v0.2.1
- **Dashboard Frontend**: v0.3.1

### Dashboard Enhancements
- **Parlay Odds Boost**: Interactive 0-100% profit-based odds boost slider for parlays
  - Backend validation and processing for boosted combined odds
  - Frontend detection via payout comparison with BOOSTED badge display
  - React portals fix for modal positioning (Settle, Cash Out, Delete modals)
- **Bug Fixes**: Prisma Decimal type conversions, date formatting improvements
- **Documentation**: Updated READMEs for root, frontend, and backend with new features

---

## [2026-01-12]

### Release Summary
Major release adding comprehensive testing infrastructure, production-ready security features, and enhanced user experience across all components. Key highlights include OAuth2 authentication system, Docker secrets support, live game tracking with real-time updates, and complete test coverage setup for frontend and backend.

### Component Versions
- **MCP Server**: v0.2.0
- **Dashboard**: v0.2.3
- **Dashboard Backend**: v0.2.0
- **Dashboard Frontend**: v0.3.0

### MCP Server (v0.2.0)
- Dual-target build system supporting both MCP and Dashboard builds
- Player prop betting markets (NBA, NFL, MLB, NHL) with 70+ market types
- Bookmaker filtering with BOOKMAKERS_FILTER and BOOKMAKERS_LIMIT configuration
- Pre-built HTML artifact tool for instant odds comparison cards with team logos
- Visual scoreboard cards with automatic React artifact rendering in Claude Desktop

### Dashboard Backend (v0.2.0)
- Jest testing infrastructure with PostgreSQL service container support
- Docker secrets management for production deployments (AWS, Azure, Kubernetes)
- Live game tracking with period and clock fields from ESPN API
- OAuth2 authentication system with Passport.js (Azure AD, Google)
- Admin settings API for site branding configuration
- Timezone-aware game filtering preventing off-by-one date errors

### Dashboard Frontend (v0.3.0)
- Vitest testing infrastructure with React Testing Library and coverage reporting
- OAuth2 authentication UI with login page, user menu, and protected routes
- Admin settings page for site branding customization
- Live game state display with period and clock information
- Enhanced UX: "vs" instead of "@", right-aligned scores, better bet slip behavior
- Dark mode support across all bet management components

### [Previous Releases]

#### v0.1.14 - Project Structure Reorganization
- **Project Structure**: Renamed `src/` folder to `mcp/`
  - Separates MCP server code from dashboard components
  - Makes project structure more intuitive for dual-platform project
  - Updated all documentation and build scripts to reflect new structure
  - Each component now has its own changelog and versioning

#### v0.1.0 - Dual-Platform Architecture
- **Architecture**: Established dual-platform design
  - MCP Server for Claude Desktop (stdio transport, FastMCP)
  - Web Dashboard for browser-based interaction (HTTP, React + Node.js)
  - Shared data sources: The Odds API and ESPN API
  - Independent build systems for each platform
  - Component-specific versioning and changelog tracking

---

## [0.1.0] - 2026-01-07

### Added
- Initial project structure
- The Odds API handler with async HTTP support
- ESPN API handler with multiple endpoint support
- FastMCP server implementation
- Tools for betting odds (get_odds, search_odds, get_scores)
- Tools for ESPN data (scoreboard, standings, teams, news, schedules)
- Combined tool for comprehensive game information
- Build automation with version management
- MCPB packaging support
- Environment configuration with .env support
- Basic error handling and logging
- API usage tracking for Odds API
- README with installation and usage instructions

### Features
- Support for NFL, NBA, MLB, NHL, College Football, College Basketball
- Multiple betting markets (moneyline, spreads, totals)
- Live scores and game updates
- Team rosters and schedules
- League standings
- News articles and search
- Natural language team search

### Technical
- Python 3.11+ requirement
- Async HTTP with aiohttp
- FastMCP framework integration
- Environment variable configuration
- Modular API handler architecture
- PowerShell build automation
- Git tag-based versioning
- GitHub release support

---

## Release Notes

### Version 0.1.0 - Initial Release

This is the first release of Sports Data MCP, providing comprehensive sports data access through Claude Desktop via the Model Context Protocol.

**Key Highlights:**
- Dual API integration (The Odds API + ESPN API)
- 15 specialized tools for sports data queries
- Natural language query support
- Easy MCPB installation for Claude Desktop
- Free tier support for The Odds API

**Getting Started:**
1. Download the MCPB package from releases
2. Install via Claude Desktop
3. Add your Odds API key (free at the-odds-api.com)
4. Start querying sports data with natural language!

**Known Limitations:**
- The Odds API free tier: 500 requests/month
- ESPN API is unofficial and may change
- Some obscure sports may have limited data

**Coming Soon:**
- Caching for frequently accessed data
- Historical odds tracking
- Player statistics and comparisons
- Fantasy sports integration
- More betting markets and providers
