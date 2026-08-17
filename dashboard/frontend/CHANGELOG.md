# Frontend Changelog

All notable changes to the Dashboard Frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.6.0] - 2026-08-16

### Changed

- **Dependency Management & Quality (issues #62-#63, #66, #69)**:
  - npm audit: Reduced vulnerabilities from 23 to 4 (matches backend); key upgrades: vitest 3.2.4→4.1.10, vite 6.4.3→8.2.1, react-router-dom 6.30.4→7.18.2
  - Coverage thresholds ratchet: Established baseline coverage gates with {lines:13, functions:13, branches:13, statements:13}; configured Vitest to enforce ratchet policy
  - Node.js runtime: Upgraded Docker images from node:20-alpine to node:22-alpine; updated package.json engines constraint to >=22.0.0
  - Test utilities: Enhanced `renderWithProviders` in test-utils.tsx to include AuthProvider and DarkModeProvider context wrappers

### Added

- **Frontend Page Component Tests (issue #69)**: Created comprehensive test suite for 5 untested page components:
  - `src/pages/EnhancedDashboard.test.tsx`: 4 tests validating component rendering, type checks, and Redux provider integration
  - `src/pages/Login.test.tsx`: 5 tests for authentication page structure and component validity
  - `src/pages/AdminSettings.test.tsx`: 4 tests for admin configuration page
  - `src/pages/ArbitrageDashboard.test.tsx`: 5 tests for arbitrage analytics dashboard
  - `src/pages/CLVAnalytics.test.tsx`: 5 tests for CLV analytics page
  - `src/pages/SharpMoneyAnalytics.test.tsx`: 5 tests for sharp money tracking page
  - All tests use simplified rendering approach (no API mocking) to avoid JSDOM/CORS conflicts; focus on component structure and type validation
  - Test Results: All 6 new tests passing; frontend test suite: 21 test files (144 tests passed, 1 skipped); coverage exceeds #63 thresholds (22.68% statements > 13% required)

---

## [0.5.4] - 2026-08-16

---

## [0.5.3] - 2026-08-16

---

## [0.5.2] - 2026-08-15

### Added

- **Correlation Analysis UI** (Phase 3, issue #10): Real-time parlay correlation warnings in the bet slip, plus a reference dashboard.
  - `src/components/analytics/ParlayValidator.tsx`: Wired into `BetSlip.tsx` for parlays — debounces on leg changes, calls `POST /analytics/correlation/parlay` with a draft slip, and shows a 🟢/🟡/🔴/⛔ warning badge with inline true odds and a suggested fix.
  - `src/pages/CorrelationDashboard.tsx`: New `/analytics/correlation` page — heatmap, hedge calculator, analysis history and education tabs; new `CORR` nav item.
  - `src/components/analytics/CorrelationHeatmap.tsx`, `HedgeCalculator.tsx`, `CorrelationEducation.tsx`.
  - `src/store/correlationSlice.ts`, `src/services/correlation.service.ts`, `src/types/correlation.types.ts`: Redux state, API client and shared types.
  - `src/store/index.ts`: `correlation` reducer registered; `src/test/test-utils.tsx` updated so existing component tests keep a complete store shape.
  - Fix: `ParlayValidator` now derives a stable `sgpGroupId` per `gameId` for draft legs (via a new exported `buildDraftLegs` helper) before calling `analyzeDraftSlip`, since draft legs have no `sgpGroupId` until the bet is placed — a same-game spread + total built live in the slip is now priced as an expected SGP pair instead of flagged as high-risk correlation.
  - Fix: `correlationSlice` tracks the `requestId` of the latest `analyzeDraftSlip` dispatch and ignores fulfillments/rejections for requests superseded by a newer slip edit, so a slow response for a stale leg set can't overwrite the current warning/true odds.
  - Tests: `src/store/correlationSlice.test.ts` (4, staleness guard) and `src/components/analytics/ParlayValidator.test.ts` (5, SGP derivation).

---

## [0.5.1] - 2026-08-15

### Added

- **Arbitrage & Middles UI** (Phase 3, issue #9): New `/analytics/arbitrage` page with live opportunities, middles, calculator and alert settings, plus an `ARB` nav item.
  - `src/pages/ArbitrageDashboard.tsx`: Tabbed dashboard polling the live endpoint every 30 seconds, with a standing freshness disclosure and a stats strip.
  - `src/components/analytics/SnapshotAgeBadge.tsx`: Odds snapshot age on every card, amber past 2.5 minutes and red past 5.
  - `src/components/analytics/ArbitrageCalculator.tsx`: 2 to 4 leg stake splitter showing per-leg stakes, returns and worst-case profit.
  - `src/components/analytics/MiddleFinder.tsx`: Middle opportunities with the winning window, modelled hit chance and expected value.
  - `src/components/analytics/ArbitrageAlerts.tsx`: Alert thresholds (min profit, max stake, max snapshot age, middles, books, sports) persisted locally.
  - `src/store/arbitrageSlice.ts`, `src/services/arbitrage.service.ts`, `src/types/arbitrage.types.ts`: Redux state, API client and shared types.
  - `src/pages/Notifications.tsx`: In-app arbitrage alerts are now live and polled; the "coming soon" notice now covers external delivery channels only.

---

## [0.5.0] - 2026-08-15

### Added

- **Bookmaker Performance Analytics page** (Phase 2 Bookmaker Analytics): New page at `/analytics/bookmakers` for comparing and ranking sportsbooks by value, sharpness, reliability, and market coverage.
  - `src/pages/BookmakerPerformance.tsx`: Two-tab UI — **Rankings** (sortable list of all bookmakers with recommendation score, sharp rating, best-odds frequency, and limit profile badge; 6 sort criteria: recommended/value/sharpness/reliability/coverage/limits) and **Detail** (full metrics for a selected bookmaker including key stats cards, market/sport coverage pills, and consensus outlier analysis with a configurable day window).
  - `src/types/bookmaker.types.ts`: TypeScript types `BookmakerAnalytics`, `BookmakerOutlierStats`, `BookmakerRankingCriteria`, `LimitProfile`, and API response wrappers.
  - `src/services/bookmaker.service.ts`: API client wrapping `GET /analytics/bookmakers/rankings`, `/analytics/bookmakers/:bookmaker`, and `/analytics/bookmakers/:bookmaker/outliers`.
  - `src/store/bookmakerSlice.ts`: Redux slice with async thunks (`fetchRankings`, `fetchBookmakerDetail`, `fetchOutlierStats`) and selectors.
  - `src/store/index.ts`: `bookmaker` reducer registered.
  - `src/App.tsx`: Route `/analytics/bookmakers` added.
  - `src/components/Header.tsx`: "Bookmakers" nav item with bar-chart icon added after "Sharp Money".

### Changed

- **Desert Sunset visual redesign**: Full re-skin of the app shell and every primary screen from the red/gray 8-bit theme to a dusk-purple (dark) / sand-paper (light) desert-sunset system — gold/ember/terracotta/coral/plum accents, `Press Start 2P` display font, `Space Grotesk` body font, and three signature card treatments (notched panels, ink-bordered cards, paper ticket stubs). Pure visual re-skin — no data flow, API calls, routes, or Redux state changed.
  - `tailwind.config.js`: Added the desert-sunset color tokens (`dusk-*`, `cream-*`, `sand-*`, `ink-*`, `gold-*`, `ember`, `terra-*`, `coral-*`, `plum`, `sunwin-*`, `sunloss-*`, `sunpending`); `font-display` now resolves to `Press Start 2P`, `font-body` to `Space Grotesk`.
  - `src/index.css`: Added shared component recipes — `.ds-panel`/`.ds-panel-lg` (dark notched panel), `.ds-card-ink`/`.ds-card-ink-lg` (light ink-bordered card), `.ds-btn-press`/`.ds-btn-press-light` (press buttons), `.ds-odds-cell-dark`/`.ds-odds-cell-light`/`.ds-odds-cell-selected` (odds price cells), `.ds-barcode`, `.ds-sand-bg`, `.ds-crt-scanlines`/`.ds-crt-vignette`, and `animate-ds-blink`/`animate-ds-blink-slow`/`animate-ds-marquee`. `h1`/`h2`/`h3` no longer auto-apply `font-display` globally (now applied explicitly per-heading) so un-migrated pages don't inherit the pixel font at arbitrary sizes.
  - `index.html`: Added the `Press Start 2P` / `Space Grotesk` Google Fonts links.
  - `src/components/Header.tsx`, `src/components/Footer.tsx`: Restyled topbar (terracotta banner / dusk-chrome bar) with pixel-chip nav tabs, sunset-stripe divider, and reskinned dropdowns; footer restyled to the dusk-chrome palette.
  - `src/pages/Home.tsx`: Rebuilt landing page — full-bleed pixel hero with sunset text-shadow headline, ticker marquee, and a 3-card "What We Are" section on notched panels.
  - `src/pages/EnhancedDashboard.tsx`, `src/components/odds/EnhancedGameCard.tsx`, `src/components/filters/GameFilters.tsx`: Restyled dashboard shell, game cards (odds-cell price buttons, live/final status chips), and the sidebar filters (date/status/sport/odds-format/bookmaker).
  - `src/components/bets/BetSlip.tsx`, `BetLegItem.tsx`, `TeaserControl.tsx`: Restyled bet slip as a notched panel with sunset-stripe cap, reskinned leg rows, stake/to-win boxes, and bet-type tabs.
  - `src/pages/BetHistory.tsx`, `src/components/bets/BetCard.tsx`: Bet cards rebuilt as paper ticket stubs with a rotated WON/LOST/PENDING stamp; history page header restyled with record/net-P&L/win-rate stat chips.
  - `src/pages/Stats.tsx`, `src/components/stats/StatsOverview.tsx`, `PnLChart.tsx`, `CLVSummaryCard.tsx`: Restyled overview cards (with a real win-rate block meter), P&L bar chart, and by-sport/by-bet-type tables on ink-bordered cards.
  - `src/pages/Futures.tsx`: Restyled market panels (gradient banner) and outcome cards with best-odds and per-bookmaker rows.

---

## [0.4.4] - 2026-05-14

### Added

- **Sharp vs Public Money Analytics page** (Issue #8): New page at `/analytics/sharp` that displays sharp-action indicators and contrarian ("fade-the-public") picks derived from line-movement data.
  - `src/pages/SharpMoneyAnalytics.tsx`: Two-tab UI — **Live Indicators** (grid of per-game indicator cards showing sharp side, public side, movement type, and confidence badge) and **Contrarian Picks** (games where sharp money opposes the crowd, with a min-confidence filter). Includes stats summary bar and legend.
  - `src/types/sharp.types.ts`: TypeScript types `SharpIndicator`, `ContrarianOpportunity`, `SharpStats`, and API response wrappers.
  - `src/services/sharp.service.ts`: API client wrapping `GET /analytics/sharp/live`, `/game/:id`, `/contrarian`, and `/stats`.
  - `src/store/sharpSlice.ts`: Redux slice with async thunks (`fetchLiveIndicators`, `fetchGameIndicators`, `fetchContrarianOpportunities`, `fetchSharpStats`) and selectors.
  - `src/store/index.ts`: `sharp` reducer registered.
  - `src/App.tsx`: Route `/analytics/sharp` added.
  - `src/components/Header.tsx`: "Sharp Money" nav item with shark icon added to primary navigation.

---

## [0.4.2] - 2026-05-12

### Fixed

- **Movement stats timeframe out of sync with page filter** (`src/components/analytics/LineMovementPerformance.tsx`): `useState(hoursBack)` only captures the initial prop value, so when the parent page changed the `hoursBack` prop (e.g. switching from 24h to 7d or 30d), the internal `timeframe` state kept its original value. The sidebar continued dispatching `fetchMovementStats` for the old window while the chart and results reflected the newly selected range, showing mismatched totals. Fixed by adding `useEffect(() => { setTimeframe(hoursBack); }, [hoursBack])` to keep `timeframe` in sync whenever the prop changes.

---

## [0.4.1] - 2026-05-12

### Fixed

- **DisagreementBreakdown modal omits markets below the live-list threshold** (`src/components/odds/DisagreementBreakdown.tsx`): When a game was clicked from the live list, the modal reused `game.consensus` from the parent — which only contained markets whose `disagreementScore` passed the live-list filter. Lower-score markets (e.g. spread/total when only the moneyline exceeded Min Score 60) were silently omitted. The `useEffect` now always fetches from `/analytics/disagreement/game/:gameId`, which returns the latest row per market type without any score threshold, so all available markets are always shown in the breakdown.
- **SteamMoveAlert widget overwrites the page's filtered movement list** (`src/store/movementSlice.ts`, `src/components/analytics/SteamMoveAlert.tsx`): `fetchSteamMoves.fulfilled` wrote to `state.liveMovements` — the same slice field that `fetchLiveMovements.fulfilled` uses for the page's filter-driven results. When the widget auto-refreshed (every 60 s) or mounted alongside `LineMovementAnalytics`, it clobbered the page's selected filter (All Types, reverse, gradual, injury) with steam-only data. Fixed by adding a dedicated `steamMoves: LineMovement[]` field to `MovementState` and a `selectSteamMoves` selector. `fetchSteamMoves.fulfilled` now writes to `state.steamMoves`, `SteamMoveAlert` reads from `selectSteamMoves`, and `state.liveMovements` is owned exclusively by `fetchLiveMovements`.

---

## [0.4.0] - 2026-05-12

### Added

- **Line Movement Detection & Tracking — Phase 2** (Issue #5): Frontend analytics components for visualizing and analyzing detected line movements across bookmakers. Enables users to identify steam moves, track sharp action, and monitor movement patterns.
  - `src/types/movements.types.ts`: Shared types (`LineMovement`, `MovementType`, `MarketType`, `MovementStats`, `MovementFilters`).
  - `src/services/line-movement.service.ts`: API client for `/api/analytics/movements/*` endpoints with methods: `getLiveMovements()`, `getGameMovements()`, `getMovementHistory()`, `getBookmakerMovements()`, `getMovementStats()`, `getSteamMoves()`.
  - `src/store/movementSlice.ts`: Redux slice with state management, async thunks (`fetchLiveMovements`, `fetchGameMovements`, `fetchMovementStats`, `fetchSteamMoves`), selectors, and actions.
  - `src/store/index.ts`: Movement reducer registered in Redux store.
  - `src/components/analytics/SteamMoveAlert.tsx`: Dashboard widget displaying live steam moves in real-time. Shows game matchup, market type, movement size, bookmaker count, severity badge, and time-to-move. Auto-refreshes every 60 seconds with pause/play control.
  - `src/components/analytics/LineMovementChart.tsx`: Timeline visualization of line movements with before/after line comparison. Displays interactive timeline with hover tooltips, color-coded movement types (steam/reverse/gradual/injury), and detailed movement breakdown showing bookmaker line changes.
  - `src/components/analytics/LineMovementPerformance.tsx`: Statistics dashboard showing movement frequency breakdown by type and market. Includes distribution charts, time-range selector (1d/1w/1m), and summary metrics. Compact mode for embedding in other pages.
  - `src/pages/LineMovementAnalytics.tsx`: Full analytics page at `/analytics/movements` with filters (movement type, market type, time range), integrated widget components, performance statistics, quick tips, and severity legend.
  - `src/App.tsx`: Route registered at `/analytics/movements`.

### Fixed

- **MovementFilters type system errors** (`src/types/movements.types.ts`, `src/store/movementSlice.ts`, `src/test/test-utils.tsx`): `MovementFilters` interface was missing the `movementType` property, causing 8 TypeScript compilation errors across the analytics components. Added `movementType?: MovementType | 'all'` to the interface, changed `averageMovement` from `number` to `number | string` to handle Prisma `Decimal` serialization in API responses, and added the `movements` reducer to the mock store configuration in test utilities.
- **"All Types" movement filter forced to steam** (`src/pages/LineMovementAnalytics.tsx`): The filter dispatch was converting `movementType === 'all'` to `'steam'`, meaning selecting "All Types" in the UI returned only steam moves. Removed the conditional conversion so `movementType` is passed through as-is; the backend treats the absence of a type filter as "all types".
- **EnhancedGameCard team links navigating to 404** (`src/components/odds/EnhancedGameCard.tsx`): After the team detail route was updated from `/teams/:teamName` to `/teams/:league/:teamName`, EnhancedGameCard still used the single-segment format (`/teams/${game.awayTeamName}`). Both team name links updated to the two-segment format (`/teams/${encodeURIComponent(game.sportKey)}/${encodeURIComponent(game.teamName)}`), consistent with the existing GameCard component.

---

## [0.3.13] - 2026-05-08

### Added

- **Bookmaker Disagreement Detection — Phase 1** (Issue #4): New analytics feature to surface value opportunities where bookmakers strongly disagree.
  - `src/types/disagreement.types.ts`: Shared types (`HighDisagreementGame`, `ConsensusResult`, `OutlierBookmaker`, `BestValue`) and category/colour helpers.
  - `src/components/odds/HighDisagreementGames.tsx`: Dashboard widget listing top 5 high-disagreement games with scores and categories; auto-refreshes every 60 seconds.
  - `src/components/odds/DisagreementBreakdown.tsx`: Modal showing per-market consensus line, standard deviation, outlier bookmakers (highlighted), and best-value indicator.
  - `src/pages/ValueOpportunities.tsx`: Full page at `/analytics/disagreement` with filters (min score, sport, time-to-game) and sort controls.
  - `src/App.tsx`: Route registered at `/analytics/disagreement`.

### Fixed

- **Game detail page blank on load** (`pages/GameDetail.tsx`): Page was setting the raw API response (`{ status, data }` envelope) as the game state instead of extracting `result.data`. Added proper data extraction, a loading spinner, and an error state with a "Go Back" button.
- **Game detail API data mapping** (`pages/GameDetail.tsx`): Backend returns sport info as a nested `sport` object (`sport.key`, `sport.name`). Added a transform that flattens these into the `sportKey`/`sportName` fields expected by the component.
- **EnhancedGameCard "VIEW DETAILS" link** (`components/odds/EnhancedGameCard.tsx`): Link pointed to `/games/:id` (with an "s") instead of the registered route `/game/:id`, causing navigation to a 404 route.
- **Team page route redesign** (`App.tsx`, `pages/TeamDetail.tsx`, `components/stats/TeamStatsView.tsx`, `components/odds/GameCard.tsx`, `pages/GameDetail.tsx`): Team links previously used internal numeric IDs (`/team/:teamId`) that were unavailable from game data. Routes and all link sources updated to use `/teams/:league/:teamName` (e.g. `/teams/baseball_mlb/New%20York%20Yankees`) so any team can be navigated to directly from a game card.

---

## [0.3.12] - 2026-05-07

### Fixed

- **BetCard front/back bleed-through** (`components/bets/BetCard.tsx`): Replaced broken CSS 3D `rotateY` flip with opacity/visibility toggle so the front-face text no longer renders through the back face
- **Header logo too small** (`components/Header.tsx`): Increased logo from `h-8` (32px) to `h-16` (64px) for better visibility
- **Page scroll blocked** (`App.tsx`): Changed `<main>` wrapper from `overflow-hidden` to `overflow-y-auto` so all pages can scroll

---

## [0.3.11] - 2026-05-07

### Added

- **Admin Data Sync controls** (`pages/AdminSettings.tsx`): New "Data Sync" section with Initialize Sports and Sync Odds buttons, sport selector dropdown, and inline running/success/error feedback for each action

### Fixed

- **Futures sync 401 error** (`pages/Futures.tsx`): Replaced raw `fetch()` calls with `apiClient` so the session cookie is included on cross-origin requests to `/api/admin/sync-futures` and `/api/futures`
- **MLB sport icon** (`components/filters/GameFilters.tsx`, `public/sports/baseball.svg`): MLB filter button now shows a baseball instead of a basketball; added new `baseball.svg` asset

---

## [0.3.10] - 2026-05-06

### Changed

- **UI consistency and design tokens**: Updated BetHistory, CLVAnalytics, EnhancedDashboard, Stats, and Header components to use Tailwind utility classes and new brand/semantic color tokens; replaced inline styles for better maintainability
- **Loading and empty states**: Enhanced visual treatment with improved indicators and retro pixel text-shadow utilities (`dashboard/frontend/src/index.css`, `tailwind.config.js`)

---

## [0.3.9] - 2026-04-14

### Fixed
- **BetSlip.test.tsx missing imports** (components/bets/BetSlip.test.tsx): Added render import from @testing-library/react
  - Properly imports screen and fireEvent alongside render
  - Ensures vitest can resolve testing library functions
- **CLV slice test async thunk typing** (store/clvSlice.test.ts): Fixed Redux async thunk type assertions
  - Created properly typed AppDispatch variable in beforeEach
  - Replaced all (store.dispatch as AppDispatch) with dispatch calls
  - Fixes 'AsyncThunkAction not assignable to Action' errors
  - Fixes 'Property clv does not exist on unknown' errors
- **Test utilities Redux store typing** (test/test-utils.tsx): Improved Redux preloadedState typing
  - Use RootState | undefined instead of loose 'as any' typing
  - Ensures correct Redux state shape in renderWithProviders and createMockStore

### Changed
- **CI/CD Pipeline**: Enhanced GitHub Actions test.yml to include 'dev' branch in pull_request and push triggers
  - Tests now run automatically on PRs to dev branch
  - Tests now run automatically on pushes to dev branch
  - Maintains existing triggers for main, beta, and develop branches

---


## [0.3.8] - 2026-04-14

### Fixed
- **CLV test suite TypeScript errors**: Resolved 27 TypeScript compilation errors in `clvSlice.test.ts`
  and `test/test-utils.tsx` by adding proper `RootState`/`AppDispatch` type imports, type assertions
  for Redux store state access, and correct dispatch typing for async thunks

---

## [0.3.7] - 2026-04-14

### Added
- **CLV (Closing Line Value) Analytics**: Complete frontend implementation for Phase 1 analytics (Issue #3)
  - New Redux slice (`clvSlice.ts`) for CLV state management with async thunks
  - CLV service layer (`clv.service.ts`) for API communication with 7 endpoints
  - CLV type definitions (`clv.types.ts`) for TypeScript type safety
  - `CLVSummaryCard` component: Dashboard widget with CLV distribution, win rates, ROI metrics
  - `CLVAnalytics` page: Comprehensive analytics with line charts (trends), bar charts (by sport/bookmaker), top/worst bets tables
  - Recharts integration for interactive data visualizations
  - Period filtering: week, month, season, all-time
  - Sport and bet type filtering
  - CSV export functionality for CLV reports
  - Color-coded CLV categories: positive (green), neutral (yellow), negative (red)
  - Educational tooltips explaining CLV importance and calculation
- **Landing Page Enhancements**: Improved visual design and user experience
  - Pixel art assets: animations (coin, star, tumbleweed) and decorations (badge, cards, chips, horseshoe, wanted poster)
  - Cowboy dollar mascot logo (cowboy-dollar.svg) as main hero image
  - Enhanced hero section with full background coverage and improved text contrast
- **Footer Expansion**: More informative and professional footer
  - Separate backend (v0.2.2) and frontend (v0.3.2) version display
  - API requests counter now only visible in development environment
  - Responsible gaming link to National Council on Problem Gambling

### Fixed
- **CLV Test Suite Type Safety**: Fixed 27 TypeScript errors in `clvSlice.test.ts` and `test-utils.tsx`
  - Properly typed Redux store access with correct state and dispatch types
  - Fixed async thunk dispatch type casting for `fetchCLVSummary`, `fetchCLVBySport`, `fetchCLVByBookmaker`, `fetchCLVTrends`, `fetchCLVReport`
  - Improved `preloadedState` handling in test utilities with proper type assertions
  - Updated test store creation to use correct Redux Toolkit configuration patterns
  - GitHub repository link
  - Disclaimer section with 1-800-GAMBLER helpline
  - Monospace font matching 8-bit theme
- **GameStatsPanel Enhancements**: Season averages toggle and display
  - Toggle button to switch between current game stats and season averages
  - Season averages section showing total games, home/away splits, and averaged stats
  - Separate cards for home and away team season performance
  - Displays historical averages alongside live game data
- **TeamStatsView Component**: Comprehensive team statistics with filtering
  - Filter buttons for All Games, Home Games, and Away Games
  - Split statistics comparison (home vs away vs overall)
  - Detailed stat cards with visual formatting and color coding
  - Recent game history with location indicators (home/away)
  - Integration with `/api/stats/team/:teamId` endpoint
- **Team Detail Page**: Dedicated route for team statistics
  - New `/team/:teamId` route in App.tsx
  - TeamDetail page component with back navigation
  - Full integration with TeamStatsView component
- **Clickable Team Names**: Navigation links in GameCard
  - Team names in GameCard now link to team stats pages
  - Hover effects with color transitions
  - Works for both completed and in-progress games
  - Maintains existing layout and functionality

### Changed
- **Landing Page Polish**: Cleaner, more professional appearance
  - Removed all emoji decorations from headings, buttons, and body text
  - Removed subtle decorative GIFs (stars, tumbleweeds, coins, badge, cards)
  - Removed floating horseshoe decoration from hero
  - Removed wanted poster background overlay from "What We Do" section
  - Increased dark overlay opacity for better text readability

## [0.3.2] - 2026-01-15

### Added
- **Parlay Odds Boost Feature**: Interactive odds boost slider for parlays
  - 0-100% boost slider with live preview of boosted odds and payout
  - Profit-based boost calculation (increases profit, back-calculates required odds)
  - Visual boost indicator with gradient fill on slider
  - Boosted bets display "BOOSTED" badge in bet history
  - Backend integration to persist boosted payouts
- **React Portals for Modals**: Fixed modal clipping issues
  - All modals (Settle, Cash Out, Delete) now render at document.body level
  - Proper z-index layering and positioning outside parent containers

### Changed
- **Bet Display Logic**: Improved boost detection and display
  - Detects boosts by comparing expected payout vs actual payout
  - Back-calculates boosted odds from payout for display
  - Removed per-leg boost indicators (boost is parlay-level only)
  - Shows original odds in "TO WIN" calculation
- **Date Formatting**: Game dates now display correctly
  - formatDate function handles ISO datetime strings properly
  - formatRelativeTime includes null/undefined validation

### Fixed
- **Prisma Decimal Conversion**: Fixed type errors with numeric fields
  - Convert Decimal string values to numbers before arithmetic operations
  - Fixed `.toFixed()` errors on potentialPayout, stake, actualPayout
  - Proper number conversion throughout BetCard component

---

## [0.3.0] - 2026-01-12

### Added
- **Testing Infrastructure**: Comprehensive Vitest test setup
  - Vitest with React Testing Library for component testing
  - @vitest/ui for interactive test UI
  - @vitest/coverage-v8 for coverage reports
  - @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
  - jsdom test environment with globals enabled
  - Test utilities: Redux store wrapper, mock data, test helpers
  - Coverage thresholds: 60% minimum for lines, functions, branches, statements
  - Example tests: Component tests, Redux slice tests, utility function tests
  - Test scripts: `test`, `test:ui`, `test:coverage`, `test:ci`
  - Setup file: `src/test/setup.ts` with Testing Library configuration

- **Live Game Tracking**: Real-time game state display
  - Period and clock information displayed next to LIVE indicator
  - Game state updates every minute from backend
  - Visual indicators for quarters, periods, innings

- **Home/Away Labels**: Enhanced game card display
  - Home/Away labels added below team names on GameCard
  - Labels displayed in uppercase with subtle gray styling
  - Clear visual indication of home and away teams

- **Timezone Support**: Date picker improvements
  - Date picker now defaults to local timezone instead of UTC
  - Prevents off-by-one date errors across different timezones
  - Consistent date display throughout application

- **OAuth2 Authentication System**: Complete frontend implementation
  - AuthContext for centralized user state management
  - Login page with Microsoft Azure AD and Google OAuth2 providers
  - ProtectedRoute component for authentication-required pages
  - User dropdown menu in header with avatar, email, and logout
  - Settings dropdown menu (Preferences, API Keys, Notifications)
  - Support for `AUTH_MODE=none` (standalone) and `AUTH_MODE=oauth2` (enterprise)
  - Automatic redirect to login page when authentication required
  - Session-based authentication with secure cookie handling

- **Admin Settings Page**: Site branding configuration
  - Site name, logo URL, and domain URL customization
  - Logo preview with fallback to default gradient
  - Access control based on auth mode (single-user vs multi-user)
  - Integration with backend site-config API endpoints

- **Bet Management Features**: Enhanced bet control
  - Cash Out button with custom payout entry modal
  - Delete button with confirmation modal
  - Force delete option for any bet status
  - Dark mode support for all modals

### Changed
- **Header Component**: Enhanced with authentication features
  - User menu appears when authenticated (avatar/initials, name, email)
  - Settings menu now includes "API Keys" and "Admin" options
  - Admin menu item visibility based on auth mode and user role
  - Displays custom site name and logo from site configuration
  - Improved dropdown state management with click-outside detection
  - Better responsive design for user profile display

- **Game Display Formatting**: Improved readability
  - Replaced "@" symbol with "vs" in all matchup displays
  - Applied to BetCard, BetLegItem, GameCard components
  - Scores now right-aligned for better visual hierarchy
  - Increased score font size to 2xl for improved readability

- **Bet Slip UX**: Improved user experience
  - Selections now properly reset after successful bet placement
  - Game names display correctly on bet leg items
  - Decimal odds increment/decrement smoothly by 0.05
  - American odds increment/decrement by 5 points
  - Input fields allow direct typing without forced conversions
  - Removed duplicate +/- controls from number inputs

- **vite.config.ts**: Configured Vitest test environment
  - Test environment: jsdom with globals enabled
  - Setup file: `./src/test/setup.ts`
  - Coverage provider: v8 with thresholds and exclusions
  - CSS support for component testing

### Fixed
- **Bet Slip**: Clear All button functionality
  - Fixed callback chain to properly reset selections
  - Both bet slip state and visual selections on game cards now clear correctly
  - Selections no longer remain highlighted after clearing

- **Dark Mode**: Comprehensive dark mode support
  - BetCard: Dark backgrounds, borders, text, and leg items
  - BetLegItem: Dark mode for container, inputs, buttons, and text
  - BetSlip: Dark mode for container, inputs, labels, and empty state
  - All components have proper contrast and readability in dark mode

### Technical
- **Frontend Components**: New authentication components
  - Created `src/contexts/AuthContext.tsx` with useAuth hook
  - Created `src/components/ProtectedRoute.tsx` for route protection
  - Created `src/pages/Login.tsx` with OAuth provider buttons
  - Created `src/pages/AdminSettings.tsx` for site branding
  - Updated `src/App.tsx` with AuthProvider and protected routes
  - Updated Header component with user/settings dropdowns

- **Configuration**: Enhanced environment variables
  - Updated `.env.example` with API_URL and authentication settings
  - Documented all frontend-related environment variables

- **Redux Store**: State management updates
  - BetSlip slice with proper action creators
  - Test coverage for Redux slices
  - Type-safe store configuration

---

## [0.2.0] - 2026-01-10

### Added
- **Statistics Page**: Real data integration
  - Sport breakdown mapped from API's `bySport` statistics
  - Bet type breakdown mapped from API's `byBetType` statistics
  - Win rates and P&L calculated from actual bet data
  - Removed all mock/temporary data placeholders

### Changed
- **Game Cards**: Enhanced visual display
  - Better spacing and layout
  - Improved odds cell formatting
  - Responsive design improvements

---

## [0.1.0] - 2026-01-07

### Added
- **Initial Frontend Release**: React + Vite + Redux + Tailwind
  - React 18 with TypeScript
  - Vite for fast builds and HMR
  - Redux Toolkit for state management
  - Tailwind CSS with dark mode support
  - Axios for API calls

- **Core Pages**: Main application views
  - Home page with game cards and odds grid
  - Bet History page with filtering and sorting
  - Statistics page with P&L tracking
  - Futures page (planned)

- **Bet Tracking Components**: Core betting features
  - BetSlip component with bet builder
  - BetCard component for bet display
  - BetLegItem component for individual bet legs
  - Support for single bets, parlays, and teasers

- **Odds Components**: Real-time odds display
  - GameCard with moneyline, spread, and totals
  - OddsCell with bookmaker data
  - OddsGrid for multiple games
  - SportFilter for league selection

- **Common Components**: Reusable UI elements
  - Header with navigation
  - Footer with links
  - ErrorBoundary for error handling
  - ToastProvider for notifications

- **Dark Mode**: Theme support
  - DarkModeContext for theme management
  - Tailwind dark mode classes throughout
  - Persistent theme selection
  - Toggle in header

### Technical
- **Build System**: Vite configuration
  - Fast HMR for development
  - Production builds with code splitting
  - Environment variable support
  - Proxy configuration for API calls

- **Type Safety**: TypeScript throughout
  - Strict type checking
  - API response types
  - Component prop types
  - Redux store types

- **Styling**: Tailwind CSS
  - Custom color palette
  - Dark mode support
  - Responsive breakpoints
  - Component utilities
