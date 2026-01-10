# Dashboard Changelog

All notable changes to the Sports Odds Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
