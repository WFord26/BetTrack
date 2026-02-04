# Frontend Changelog

All notable changes to the Dashboard Frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
