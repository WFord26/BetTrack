# Dashboard Changelog

All notable changes to the Sports Odds Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **NPM Publishing Infrastructure**: Complete GitHub Packages setup
  - Both components published as scoped packages (`@wford26/bettrack-*`)
  - Automated publishing workflow (`.github/workflows/npm-publish-dashboard.yml`)
  - Triggers on GitHub releases or manual workflow dispatch
  - `.npmignore` files for excluding development artifacts
  - Package metadata: repository info, keywords, files list
  - Documentation: `NPM-PUBLISHING.md` with complete guide
  - `.npmrc` configuration for GitHub Packages authentication

---

## [0.2.3] - 2026-01-12

### Added
- **Testing Infrastructure**: Comprehensive test setup for frontend and backend
  - Backend: Jest with ts-jest, @jest/globals, jest-mock-extended, supertest
  - Frontend: Vitest with React Testing Library, @vitest/ui, jsdom
  - Test utilities: Redux store wrapper, mock data, test helpers
  - Coverage thresholds: 60% minimum for lines, functions, branches, statements
  - Example tests: Component tests, Redux slice tests, utility function tests
  - Test scripts: `test`, `test:watch`, `test:coverage`, `test:ci`
  - Documentation: TESTING.md with setup instructions and best practices

- **CI/CD Test Automation**: GitHub Actions workflows for automated testing
  - Test & Validate workflow (`.github/workflows/test.yml`)
    - Backend tests with PostgreSQL service container
    - Frontend tests with type checking and linting
    - MCP server validation (syntax, linting, startup test)
    - Build validation for all components
    - PR comments with coverage reports
    - Codecov integration for coverage tracking
  - Enhanced release workflow with pre-release testing
    - Blocks releases if any tests fail
    - Runs linters and type checks before builds
    - Validates MCP server startup
    - Ensures build artifacts are created successfully
  - Documentation: CI-CD-TESTING.md with quick reference guide

- **Docker Secrets Support**: Production-ready secret management
  - Backend Dockerfile supports Docker secrets mounted at `/run/secrets/`
  - Automatic loading of secrets from files (ODDS_API_KEY, DB_PASSWORD, etc.)
  - Secret files converted to uppercase environment variables
  - Entrypoint script with secret loading, .env fallback, and migration support
  - Priority order: Docker secrets > Environment variables > .env file
  - New `docker-compose.prod.yml` with PostgreSQL secrets integration
  - Documentation for AWS Secrets Manager, Azure Key Vault, and Kubernetes secrets
  - `secrets/` directory with README and .gitignore setup
  - Support for `AUTO_MIGRATE=true` to run Prisma migrations on container start

- **Admin Settings Page**: Site branding configuration
  - Site name, logo URL, and domain URL customization
  - Logo preview with fallback to default gradient
  - Access control based on auth mode (single-user vs multi-user)
  - New SiteConfig database table with Prisma schema
  - Backend API endpoints: GET/PUT `/api/admin/site-config`
  - Header component fetches and displays custom branding

- **OAuth2 Authentication System**: Complete frontend implementation
  - AuthContext for centralized user state management
  - Login page with Microsoft Azure AD and Google OAuth2 providers
  - ProtectedRoute component for authentication-required pages
  - User dropdown menu in header with avatar, email, and logout
  - Settings dropdown menu (Preferences, API Keys, Notifications)
  - Support for two modes: `AUTH_MODE=none` (standalone) and `AUTH_MODE=oauth2` (enterprise)
  - Automatic redirect to login page when authentication required
  - Session-based authentication with secure cookie handling

### Changed
- **Backend package.json**: Added test dependencies and scripts
  - Added: `jest`, `ts-jest`, `@jest/globals`, `jest-mock-extended`, `supertest`, `@types/jest`, `@types/supertest`
  - Scripts: `test`, `test:watch`, `test:coverage`, `test:ci`

- **Frontend package.json**: Added test dependencies and scripts
  - Added: `vitest`, `@vitest/ui`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
  - Scripts: `test`, `test:ui`, `test:coverage`, `test:ci`

- **Frontend vite.config.ts**: Configured Vitest test environment
  - Test environment: jsdom with globals enabled
  - Setup file: `./src/test/setup.ts`
  - Coverage provider: v8 with thresholds and exclusions
  - CSS support for component testing

- **Backend Dockerfile**: Enhanced for production security
  - Multi-stage build with builder and runtime stages
  - Non-root user (nodejs:1001) for security
  - dumb-init for proper signal handling
  - Custom entrypoint with secret loading logic
  - Health check endpoint for container orchestration

- **Header Component**: Enhanced with authentication features
  - User menu appears when authenticated (avatar/initials, name, email)
  - Settings menu now includes "API Keys" and "Admin" options
  - Admin menu item visibility based on auth mode and user role
  - Displays custom site name and logo from site configuration
  - Improved dropdown state management with click-outside detection
  - Better responsive design for user profile display

### Security
- **Secret Management**: Production-grade security improvements
  - Secrets never logged or exposed in container images
  - File-based secrets with proper permissions (chmod 600)
  - Support for external secret stores (AWS, Azure, Kubernetes)
  - Clear separation between development (.env) and production (secrets) configs

### Technical
- **Database Schema**: New tables and fields
  - `SiteConfig` model with id (default 1), siteName, logoUrl, domainUrl
  - `User.isAdmin` boolean field for admin access control
  - Migration: `20260112174137_add_admin_settings`

- **Frontend**: New authentication components
  - Created `src/contexts/AuthContext.tsx` with useAuth hook
  - Created `src/components/ProtectedRoute.tsx` for route protection
  - Created `src/pages/Login.tsx` with OAuth provider buttons
  - Updated `src/App.tsx` with AuthProvider and protected routes
  - Updated Header component with user/settings dropdowns
- **Configuration**: Enhanced environment variables
  - Updated `.env.example` with AUTH_MODE, SESSION_SECRET, OAuth credentials
  - Documented all authentication-related environment variables
- **Documentation**: Comprehensive authentication guides
  - Created `docs/AUTH-IMPLEMENTATION-SUMMARY.md` with status and testing scenarios
  - Existing `docs/AUTH_SETUP.md` provides OAuth2 provider setup instructions

---

## v0.2.0 - More in-Game Features and Fixes

### Added
- **Live Game Tracking**: Real-time game state display
  - Added `period` and `clock` fields to Game model
  - Period and clock information displayed next to LIVE indicator
  - ESPN API fetches live game state every minute (reduced from 5 minutes)
- **Visual Improvements**: Enhanced game card display
  - Home/Away labels added below team names
  - Labels displayed in uppercase with subtle gray styling
- **Timezone Support**: Date picker improvements
  - Date picker now defaults to local timezone instead of UTC
  - Prevents off-by-one date errors across different timezones

### Changed
- **Game Display Formatting**: Improved readability
  - Replaced "@" symbol with "vs" in all matchup displays (BetCard, BetLegItem, GameCard)
  - Scores now right-aligned for better visual hierarchy
  - Increased score font size to 2xl for improved readability
- **Live Updates**: More responsive game state
  - ESPN API check interval reduced from 5 minutes to 1 minute
  - Faster live score, period, and clock updates

### Fixed
- **Bet Slip**: Clear All button functionality
  - Fixed callback chain to properly reset selections
  - Both bet slip state and visual selections on game cards now clear correctly
  - Selections no longer remain highlighted after clearing

### Technical
- **Backend**: Database schema updates
  - Added `period` and `clock` fields to Game model (Prisma schema)
  - Updated outcome resolver service to capture live game state from ESPN API
  - Regenerated Prisma client with updated types
  - Fixed TypeScript compilation after schema changes

---

## [Previous Releases]

### v0.1.18 - Bet Management Features

#### Added
- **Bet Management**: Comprehensive bet control features
  - Cash Out functionality with custom payout entry for pending bets
  - Delete functionality with force option to remove any bet regardless of status
  - Confirmation modals for both actions with dark mode support

#### Changed
- **Statistics Page**: Real data integration
  - Sport breakdown now mapped from API's `bySport` statistics
  - Bet type breakdown mapped from API's `byBetType` statistics
  - Win rates and P&L calculated from actual bet data
  - Removed all mock/temporary data placeholders
- **Bet Slip UX**: Improved user experience
  - Selections now properly reset after successful bet placement
  - Game names display correctly on bet leg items
  - Decimal odds increment/decrement smoothly by 0.05 (was erratic)
  - American odds increment/decrement by 5 points
  - Input fields now allow direct typing without forced conversions
  - Removed duplicate +/- controls from number inputs

#### Fixed
- **Dark Mode**: Comprehensive dark mode support
  - BetCard: Dark backgrounds, borders, text, and leg items
  - BetLegItem: Dark mode for container, inputs, buttons, and text
  - BetSlip: Dark mode for container, inputs, labels, and empty state
  - All components have proper contrast and readability in dark mode

### v0.1.0 - Initial Dashboard Release

#### Added
- **Web Dashboard**: Full-stack React + Node.js application
  - React frontend with Vite build system
  - Node.js + Express + TypeScript backend
  - PostgreSQL database with Prisma ORM
  - Redux Toolkit for state management
  - Tailwind CSS for styling with dark mode support
- **Bet Tracking**: Core betting features
  - Create single bets, parlays, and teasers
  - Track pending, won, lost, and cashed out bets
  - View bet history with filtering and sorting
  - Detailed bet cards with leg breakdown
- **Odds Integration**: Real-time odds from The Odds API
  - Game cards with moneyline, spread, and totals
  - Multiple bookmaker support (DraftKings, FanDuel, BetMGM, etc.)
  - Odds comparison across bookmakers
  - Live game scores and status
- **Statistics**: Analytics and performance tracking
  - P&L tracking by sport and bet type
  - Win rate calculations
  - Bet count and volume statistics
  - Historical performance charts (planned)
- **Admin Tools**: Backend management
  - Initialize sports and leagues endpoint
  - Manual odds sync endpoint (background job)
  - Manual outcome resolution endpoint (background job)
  - Health check with database connectivity test
- **Scheduled Jobs**: Automated background tasks
  - Odds sync job (configurable interval)
  - Bet settlement job (configurable interval)
  - node-cron for scheduled execution

#### Technical
- **Backend Stack**
  - Express.js REST API
  - Prisma ORM with PostgreSQL
  - TypeScript for type safety
  - Winston logging with file/console transports
  - Rate limiting and timezone-aware date filtering
- **Frontend Stack**
  - React 18 with TypeScript
  - Vite for fast builds and HMR
  - Redux Toolkit for state management
  - Tailwind CSS with dark mode
  - Axios for API calls
- **Database Schema**
  - Sport, Team, Game models
  - CurrentOdds, OddsSnapshot for odds tracking
  - Bet, BetLeg models with status tracking
  - User model (authentication planned)
- **Deployment**
  - Docker Compose for local development
  - Separate dev and production configurations
  - Environment-based configuration
  - Build scripts for production deployment
