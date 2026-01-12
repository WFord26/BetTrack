# Changelog

All notable changes to Sports Data MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.2.0] - 2026-01-12

### Added
- **Dual-Target Build System**: Build script now supports both MCP and Dashboard builds
  - `-MCP` flag: Build MCPB package for Claude Desktop
  - `-Dashboard` flag: Build web dashboard (React frontend + Node.js backend)
  - Can build both simultaneously: `.\build.ps1 -MCP -Dashboard -VersionBump patch`
  - Separate clean operations: `-Clean` with `-MCP` or `-Dashboard` for targeted cleanup
  - Dashboard build creates unified dist/ with backend, frontend, Prisma schema, and deployment files
  - MCP build maintains existing MCPB packaging with version management

- **Player Prop Betting Markets**: Full support for player proposition bets
  - NBA: player_points, player_rebounds, player_assists, player_threes, player_blocks, player_steals, player_double_double, player_triple_double, and combo props
  - NFL: player_pass_tds, player_pass_yds, player_rush_yds, player_receptions, player_reception_yds, player_anytime_touchdown, player_first_touchdown, and more
  - MLB: player_home_runs, player_hits, player_strikeouts, player_rbis, player_stolen_bases, and pitching props
  - NHL: player_points, player_shots_on_goal, player_blocked_shots, player_saves, player_goals
  - All player props work with `get_odds()`, `get_event_odds()`, and `search_odds()` tools
  - Use markets parameter: `markets="player_points,player_rebounds"` to query player props
  - Combine with game markets: `markets="h2h,spreads,player_points"`

- **Bookmaker Filtering**: New environment variables to control which betting sites are searched
  - `BOOKMAKERS_FILTER`: Comma-separated list of bookmaker keys to include (e.g., `draftkings,fanduel,betmgm`)
  - `BOOKMAKERS_LIMIT`: Maximum number of bookmakers to show per game (default: 5)
  - Filters apply to all odds queries: `get_odds()`, `get_event_odds()`, `search_odds()`
  - Reduces API response size and focuses on preferred sportsbooks
  - Common bookmaker keys: draftkings, fanduel, betmgm, caesars, barstool, pointsbet, bet365, mybookieag, bovada, williamhill

- **Pre-Built Artifact Tool**: `get_odds_card_artifact()` - Returns COMPLETE HTML artifacts
  - Generates fully-populated React component with real odds data
  - **Includes real team logos** from ESPN CDN (500px high-quality PNGs)
  - No more building from scratch - Claude renders directly

### Removed
- **ASCII Art Odds Comparison**: Removed `get_odds_comparison()` tool
  - Modern visual artifacts (get_odds_card_artifact) replace text-based formatting
  - Raw API data still available via get_odds() and get_event_odds()
  - Just call: `get_odds_card_artifact("Nuggets")` → instant odds comparison card
  - Includes odds from 5 bookmakers with best odds highlighted in green
  - Much faster than instructing Claude to build artifacts manually
  - Template includes modern styling, team logos, and live data
  - Fallback to emoji if logo not found

- **Team Logo URLs**: All teams now include ESPN CDN logo URLs
  - `get_team_logo_url()` helper function generates logo URLs by team name
  - Visual scoreboard includes `home_team_logo` and `away_team_logo` fields
  - Logos displayed in HTML scoreboard example (500px PNG format)
  - Supports NFL, NBA, NHL with both standard and dark mode logos

- **Visual Scoreboard Cards in Claude**: New `get_visual_scoreboard()` tool
  - Returns structured data that automatically triggers React artifact rendering in Claude Desktop
  - Interactive visual scoreboards with team colors, live scores, and expandable betting odds
  - Smooth animations, hover effects, and modern card-based layouts
  - No more ASCII text art - get beautiful ESPN-style visual components
  - Includes render instructions that prompt Claude to create interactive artifacts
  - Example HTML scoreboard template in `examples/nfl-scoreboard.html`

### Changed
- **BREAKING: ESPN Tools Streamlined** to prevent message overflow
  - `get_espn_scoreboard()`: Now returns only essential game data (scores, teams, status)
    - Default limit reduced from 50 to 10 games, max 25
    - Removed verbose ESPN API response fields
    - Added note directing users to `get_formatted_scoreboard()` for visual output
  - `get_espn_teams()`: Returns concise team list (name, id, abbreviation, logo only)
    - Removed full team objects with extensive metadata
    - Logo URL included for each team
  - `get_espn_team_details()`: Added warning about verbose output
  - `get_espn_game_summary()`: Added warning about massive data size
  - All tools now include usage notes directing to more appropriate alternatives

- **Beta Build from Git Hash**: Build script improvements
  - `-Beta` flag now works WITHOUT requiring `-VersionBump`
  - Beta versions use git commit hash (e.g., `v0.1.10-beta.928845c`)
  - No version bump needed for quick beta testing iterations
  - Fallback to timestamp if git not available

- **Formatted Output Tools**: 7 new tools for visual display of sports data
  - `get_formatted_scoreboard`: Compact table view of games (replaces verbose JSON)
  - `get_matchup_cards`: ESPN-style matchup cards with ASCII art borders
  - `get_formatted_standings`: League standings in table format
  - `get_odds_comparison`: Side-by-side odds from multiple bookmakers
  - `get_team_reference`: Quick lookup tables for NFL/NBA/NHL teams with IDs
  - `find_team`: Search teams by name or abbreviation across leagues
  - `get_odds_comparison`: Formatted odds comparison across bookmakers

- **Team Reference Database**: Complete team data for major leagues
  - NFL: 32 teams with ESPN IDs, abbreviations, divisions
  - NBA: 30 teams with ESPN IDs, abbreviations, divisions
  - NHL: 32 teams with ESPN IDs, abbreviations, divisions
  - Quick team ID lookup for API calls

- **Enhanced Matchup Cards**: Visual improvements and new features
  - TV broadcast information from ESPN API (TNT, ESPN, ABC, etc.)
  - Multiple bookmaker odds display (up to 3 bookmakers per card)
  - Cleaner single-line box drawing characters (┌─┐├┤│└┘)
  - Wider card format (66 characters) for better readability
  - Smart team name truncation preserving team names (e.g., "Golden St... Warriors")
  - Fixed-width odds column for consistent alignment
  - Support for spread with point displays
  - Live score display for in-progress games

- **Beta Release Support**: Build script enhancements
  - `-Beta` flag for creating beta releases (e.g., v0.1.8-beta.1)
  - Sequential beta versioning (beta.1, beta.2, etc.)
  - Beta releases excluded from GitHub releases
  - Promotion from beta to stable version

- **Persistent Configuration**: Environment file preservation
  - `.env` file stored in persistent config directory (`%APPDATA%/Claude/sports-mcp-config/`)
  - Configuration survives all package updates
  - First-time setup creates `.env` from `.env.example` with helpful instructions
  - API keys never overwritten on updates

### Changed
- Improved matchup card visual design with better spacing and alignment
- Enhanced odds display with bookmaker labels and consistent formatting
- Positive odds now display with `+` prefix (e.g., `+185` instead of `185`)
- Matchup cards now merge ESPN broadcast data with Odds API betting odds
- Build script now supports both stable and beta version bumps

### Fixed
- Missing `Optional` and `Dict` type imports in `team_reference.py`
- Odds column alignment pushing outside box borders
- Team name truncation cutting names awkwardly mid-word
- `.env` file being overwritten on package updates
- Import errors preventing module loading

### Technical
- Formatter module with 4 formatting functions for cards and tables
- Team reference module with complete league databases
- Persistent config directory support via `SPORTS_MCP_CONFIG_DIR` env var
- Enhanced build script with beta versioning logic
- Auto-creation of config directory on first run

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
