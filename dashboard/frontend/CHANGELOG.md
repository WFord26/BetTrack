# Frontend Changelog

All notable changes to the Dashboard Frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
