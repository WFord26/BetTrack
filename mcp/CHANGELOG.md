# Changelog

All notable changes to Sports Data MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.0.1] - 2026-08-18

### Changed

- **`get_odds_card_artifact` decomposed (issue #74 follow-up)**: The 1.0.0 split moved this function into `artifact_tools.py` verbatim, leaving the 261-line body the issue flagged intact. Its data handling is now three module-level helpers — `_extract_book_odds()` (one bookmaker's nested markets to a flat row), `_best_focus_odds()` (best price across books), and `_render_odds_card()` (component source) — reducing the tool itself to 92 lines of orchestration.
  - Rendered output is byte-identical to the 1.0.0 version for the same input, and the not-configured/no-games/no-odds paths are unchanged.
  - The sport-to-league map duplicated in both tools is now the shared `_SPORT_LEAGUE_MAP`/`_league_for()`; the unused `other_abbr` local was dropped.
  - New `tests/test_artifact_tools.py` covers the extracted helpers (20 tests), taking `artifact_tools.py` from 16% to 62% coverage and `sports_api/` from 57% to 61%.

### Fixed

- **Odds cards for bookmakers with an apostrophe in their name produced an unparseable component**: `_render_odds_card()` embedded the per-book data with `str(books_data).replace("'", '"')`, which is a Python repr rather than JSON. A book such as "Bally's Bet" emitted `{"name": "Bally"s Bet"}`, breaking the whole artifact. Now embedded with `json.dumps()`.

---

## [1.0.0] - 2026-08-16

### Changed

- **`sports_mcp_server.py` split into `sports_api/tools/` (issue #74)**: The 1,540-line monolith (25+ inline tool definitions, one 261-line function) is now a ~220-line composition root — env/config loading, handler wiring, and five `register_*_tools(mcp, ...)` calls.
  - New modules, each exposing one `register_*_tools()` function following the same pattern as `dashboard_api/tools.py`: `odds_tools.py` (5 tools), `espn_tools.py` (8 tools), `format_tools.py` (8 tools, including the combined odds+ESPN tool and `LEAGUE_SPORT_MAP`), `artifact_tools.py` (2 tools, the React artifact generators), `diagnostics_tools.py` (2 tools, cache/key status).
  - Tool bodies, docstrings, and behavior are unchanged — verbatim moves, verified against the pre-refactor file with the new test suite and a live server-boot smoke test.
  - `sports_api/tools/__init__.py` re-exports all five registration functions.
- **Dependency Management (issue #65)**: Python dependencies now pinned with version constraints
  - Updated `requirements.txt` with exact minor-version pins: aiohttp>=3.9.0,<4.0.0, aiofiles>=23.2.0,<24.0.0, fastapi>=0.104.0,<0.105.0, pydantic>=2.5.0,<3.0.0, etc.
  - Created separate `requirements-dev.txt` for testing tools: pytest, pytest-asyncio, pytest-mock, pylint, black, mypy, type-stubs packages
  - Improves reproducibility and prevents unexpected breaking changes from transitive dependencies
  - Note: Requires Python 3.11+ per FastMCP framework requirement
- **CI now runs the test suite (issue #74 prerequisite)**: `.github/workflows/test.yml`'s `mcp-validation` job installs `requirements-dev.txt` and runs `pytest tests/ --cov=sports_api --cov-fail-under=50`, gating on the 50% threshold issue #67 set as the decomposition trigger. Previously CI only ran `py_compile`, an advisory mypy/pylint pass, and a startup smoke test — the test suite existed but nothing executed it.
  - `requirements-dev.txt` pins `aiohttp<3.14.0` for the test environment: aioresponses 0.7.9 (latest) mocks aiohttp's `ClientResponse` constructor directly, and aiohttp 3.14 added a required `stream_writer` kwarg there that breaks every aioresponses-mocked test. Production `requirements.txt` is unaffected.

### Fixed

- **`sports_api/` test suite was red, not green (issue #67 follow-up)**: closing #67 had not been re-verified against the actual code — coverage was 11%, not the 50% target, and 11 of 33 tests failed against stale assumptions (`find_team_id` return shape, `get_team_logo_url`'s real ESPN CDN domain and `dark`/`size` params, `format_scoreboard_table`'s box-drawing rather than markdown output, `format_standings_table`'s ESPN-shaped input, `format_odds_comparison`'s `List[Dict]` signature). Fixed all 11 to assert against real behavior in `test_team_reference.py` and `test_formatters.py`.

### Added

- **MCP Test Suite (issue #67)**: Comprehensive test suite for MCP server components
  - `mcp/tests/` directory structure:
    - `conftest.py`: Pytest fixtures for API specs, sample data, async mocks, event loop configuration
    - `test_formatters.py`: 55+ tests for output formatting (matchup cards, scoreboards, standings, odds tables)
      - Tests width consistency (66 chars), team name shortening, score display, empty field handling, Unicode box-drawing characters
    - `test_team_reference.py`: 45+ tests for team lookups and logo URL generation
      - Tests exact/partial/fuzzy matching, case-insensitive handling, abbreviation lookup, ESPN CDN logo URL format
    - `pytest.ini`: Configuration with asyncio_mode=auto
    - `README.md`: Comprehensive testing guide and best practices
  - 100+ tests written with coverage focus on sports_api/ components
  - Note: Local execution requires Python 3.11+ (system has 3.9.6); tests will validate in CI/CD
- **Coverage raised to the #74 decomposition trigger, then past it (issue #67 follow-up / #74)**: five new test files bring `sports_api/` from 11% to 64% before the split, and `test_tools_registration.py` covers the new `sports_api/tools/` package after it, landing at 57% overall — all gated in CI at 50%.
  - `test_team_matching.py`: sport-key inference and word-aware team matching (`guess_sport_key`, `team_matches`)
  - `test_cache.py`: TTL expiry, LRU eviction, request coalescing, and the `should_cache` predicate on `ResponseCache`
  - `test_key_manager.py`: sticky key rotation, exhausted/invalid classification, quota tracking on `APIKeyManager`
  - `test_espn_api_handler.py` / `test_odds_api_handler.py`: handler behavior against `aioresponses`-mocked HTTP, including cache hits, TTL selection, key rotation on 429, and bookmaker filtering — no real network calls
  - `test_tools_registration.py`: each `register_*_tools()` attaches the expected tool names and delegates to its handler with the right arguments, using a minimal `FakeMCP` stand-in (`mcp.tool()` decorator only) so the real `mcp` SDK package — which needs Python 3.10+ — isn't a test dependency

---

## [0.4.4] - 2026-08-16

---

## [0.4.3] - 2026-08-16

### Added

- **Response cache** (`sports_api/cache.py`): TTL cache in front of every Odds API and ESPN request. Repeated questions inside a conversation no longer each cost a request against the 500 a month free tier.
  - Concurrent identical requests are coalesced: 8 parallel calls for the same scoreboard issue 1 upstream request, not 8.
  - Only successful responses are stored, so an upstream blip cannot be cached into a full TTL window of guaranteed failure.
  - Bounded with oldest-first eviction, so a long session cannot grow it without limit.
  - Default lifetimes: odds and scores 60s, ESPN scoreboards 30s, standings and news 300s, team lists 24h, sports list 1h. All tunable via `CACHE_TTL_*`; `CACHE_ENABLED=false` turns the layer off.
- **Failure aware key rotation** (`sports_api/key_manager.py`): replaces round-robin-per-request. One key is drained before the next is touched, so the remaining keys stay at full quota as reserve and the reported "requests remaining" is a real number rather than an average across keys.
  - A key is parked as `exhausted` the moment the API reports zero remaining, so the next call rotates instead of spending a request to rediscover it.
  - HTTP 401/403 is classified by response body: an out-of-credits message parks the key as `exhausted` (recoverable, the quota resets monthly), anything else retires it as `invalid` for the session. Previously a dead key was retried every Nth request forever.
  - A key failure retries the request on the next key, at most once per key. A 5xx is treated as the API's fault, not the key's, and is not retried.
  - Duplicate keys are deduplicated, since the same key twice gave a false sense of quota headroom.
- **`get_api_status` tool**: quota remaining per key, key health, cache hit rate, and upstream requests avoided. Makes no API calls, so it costs no quota. Keys are masked to first and last 4 characters.
- **`clear_cache` tool**: drops cached responses when the user explicitly wants live data, for example right after a line moves.
- **`sports_api/team_matching.py`**: word aware team matching and league inference from a team name.

### Changed

- **`search_odds` no longer fans out across four sports by default.** It infers the league from the team name ("Chiefs" to NFL, "Red Sox" to MLB) and queries only that one, falling back to the full sweep only when the name is genuinely ambiguous (such as "Rangers") or the guess returns nothing. A typical unfiltered search drops from 4 requests to 1.
- **`search_odds` now reports `sports_searched`**, and surfaces per-sport failures under `partial_errors` instead of silently returning fewer results.
- **`markets` defaults to `h2h` explicitly** in `get_odds` and `get_event_odds`. The API already defaulted to it, but omitting the parameter produced a second cache entry for a request identical to the explicit one.
- **`_filter_bookmakers` no longer mutates in place.** With responses now cached, editing the response rewrote the cached entry, so a later hit would be filtered a second time and any caller holding the response would see it change underneath them.
- Successful responses carry a `cached` flag so callers can tell whether a result cost quota.


- **`dashboard_mcp_server.py` reduced to a thin standalone entry point** (322 lines to ~70). It still runs the dashboard tools on their own for pointing a second server at a different dashboard instance or debugging in isolation, and now also loads a neighbouring `.env`.
- **`scripts/build.sh` and `scripts/build.ps1`**: both now copy Python package directories from a list (`sports_api`, `dashboard_api`) and warn on a missing one instead of silently shipping an incomplete package. `build.ps1` additionally copies `dashboard_mcp_server.py`, which it had never included — only `build.sh` did, so macOS/Linux and Windows builds produced different archives.
- **`manifest.json`**: description now mentions the optional dashboard integration.
- **`.env.example` and `INSTALL_INSTRUCTIONS.md`**: document `DASHBOARD_API_KEY` / `DASHBOARD_API_URL`, the `bets` and `stats` permissions each tool group needs, and how to tell from the startup log which mode the server is in.

### Security

- **Real HTTPS enforcement warning**: plain `http://` pointed at a non-loopback `DASHBOARD_API_URL` now logs an explicit warning that the API key and bet data will travel unencrypted. Previously this was only a comment in `.env.example`. Loopback addresses (`localhost`, `127.0.0.1`, `::1`) stay silent.

### Fixed

- **Naive substring team matching.** `query.lower() in team.lower()` meant "LA" matched Dal**la**s Mavericks, At**la**nta Hawks, and Phi**la**delphia 76ers, and "Sox" could not distinguish Boston from Chicago. Matching is now word aware, with short queries required to match a whole word or a known abbreviation.


- **17 analytics tools** (in `dashboard_api/tools.py` after the merge below), backed by the new `/api/mcp/analytics/*` routes. All require an API key with the `stats` permission and are read only apart from the stateless stake calculator.
  - Arbitrage: `get_arbitrage_opportunities` (filters for min profit, arb type, market type, and `max_snapshot_age` so stale lines can be rejected before acting), `get_arbitrage_history`, `get_arbitrage_stats`, `calculate_arbitrage_stakes`
  - Closing line value: `get_clv_summary`, `get_clv_by_sport`, `get_clv_by_bookmaker`, `get_clv_report` (sport, bet type, and date range filters)
  - Sharp money: `get_sharp_action`, `get_contrarian_plays`, `get_game_sharp_indicators`
  - Line movement: `get_line_movements` (steam, reverse, gradual, injury, or all), `get_game_line_movements`
  - Market disagreement: `get_market_disagreement`
  - Bookmaker analytics: `get_bookmaker_rankings`, `compare_bookmakers`, `get_bookmaker_metrics`
- **`_clean_params()` helper**: strips `None` values before they reach `aiohttp`, which would otherwise serialise them as the literal string `"None"` into the query string and make the backend parse a bogus value. Booleans are converted to `"true"`/omitted rather than passed through, since `aiohttp` rejects bool query params.
- **Dashboard tools merged into the packaged server**: `sports_mcp_server.py` now registers the BetTrack dashboard tools on the same server whenever `DASHBOARD_API_KEY` is set. Previously `manifest.json` pointed only at `sports_mcp_server.py`, so `dashboard_mcp_server.py` shipped inside the `.mcpb` but was never started — anyone installing from Releases got zero dashboard tools with no indication why.
  - New `dashboard_api/` package: `client.py` (config, shared session, `make_request`) and `tools.py` (`register_dashboard_tools(mcp)` attaching all 26 tools). No tool logic is duplicated between the two entry points.
  - Registration is conditional and non-fatal. Without a key the server logs one explanatory line and runs sports-only, so nobody sees dashboard tools they cannot call. An `ImportError` from a partial install degrades to sports-only rather than taking the whole server down.
  - `client.configure()` reads the environment lazily rather than at import time, so `DASHBOARD_API_KEY` and `DASHBOARD_API_URL` can now live in the same persistent `.env` as `ODDS_API_KEY` instead of only in the process environment.
  - Tool count: 23 sports tools alone, 49 with a dashboard key configured.


- **Network errors no longer abort a tool call**: `aiohttp.ClientError` from an unreachable or down dashboard is caught and returned as a readable `{"error": "Dashboard unreachable", ...}` result instead of propagating as an exception.
- Trailing slashes on `DASHBOARD_API_URL` are stripped, so `https://host/` no longer produces `https://host//api/...`.

---
## [0.4.2] - 2026-08-15

---

## [0.4.1] - 2026-08-15

---

## [0.4.0] - 2026-08-15

---

## [0.3.4] - 2026-05-14

### Fixed
- **`scripts/build.sh` `full_release()`**: Version bump now runs as Step 2 (immediately after clean), before the Dashboard and MCPB builds. Previously the bump ran as Step 4 after both builds, causing ZIP and MCPB artifacts to contain the pre-bump versions while the release tag and notes advertised the bumped versions.
- **`scripts/build.ps1` `Invoke-FullRelease`**: Same ordering fix — `Update-ComponentVersions` moved to Step 2 before `Build-Dashboard` and `Build-MCPBPackage`, with the MCPB filename now sourced from `$versions.MCP` rather than re-reading `manifest.json` after the bump.

---

## [0.3.1] - 2026-05-13

### Added
- **`scripts/build.sh`**: Bash equivalent of `build.ps1` for macOS / Linux. Full feature parity — `--mcp`, `--dashboard`, `--version-bump`, `--bump-mcp/dashboard/backend/frontend`, `--beta` (git-hash or incremental), `--release`, `--full-release`, `--push-docker`, `--clean`. Automatically selects Python 3.10+ from Homebrew or system PATH; safe on externally-managed Homebrew environments (non-fatal dependency check).
- **`scripts/docker-build.sh`**: Bash equivalent of `docker-build.ps1`. Builds and pushes backend/frontend Docker images to GitHub Container Registry (`ghcr.io`). Each component uses its own `package.json` version independently (backend and frontend can have different version tags). Owner auto-detected from git remote and lowercased to satisfy GHCR's lowercase-only requirement. Supports `--version` override, `--platform`, `--owner`, `--repository`, and `--push` flags.

---

## [0.2.7] - 2026-05-12

### Added
- **`get_advice_context` tool**: Returns structured betting context for Claude — active pending bets, recent results, win-rate stats, and risk analysis — via `GET /api/mcp/bets/advice-context`. Accepts optional `limit` query param (default 100).
- **`get_games_with_exposure` tool**: Lists today's and tomorrow's games alongside the user's open bet exposure per game via `GET /api/mcp/games/with-exposure`. Accepts optional `sport` filter and `only_with_bets` boolean.
- **Singleton `aiohttp.ClientSession`**: Session created once at module init and shared across all requests; closed cleanly on interpreter shutdown via `atexit` (eliminates per-call overhead and unclosed-connector warnings).
- **Structured HTTP error handling in `make_request`**: Responses with status ≥ 400 now return `{"error": "HTTP <status>", "status": <int>, "detail": <body>}` instead of silently forwarding the raw response body.
- **HTTPS guidance**: `DASHBOARD_API_URL` default value comment warns that `http://` is only acceptable for local development; hosted deployments must use `https://`.

### Changed
- **All dashboard tools rewired to `/api/mcp/*`**: Replaced session-gated `/api/*` paths with API-key-authenticated `/api/mcp/*` equivalents across all seven tools — `create_bet`, `get_active_games`, `get_my_bets`, `get_bet_details`, `get_game_odds`, `get_dashboard_stats`, and `search_teams`.
- **`create_bet` new signature**: Parameters changed to `(game_id, selection_type, selection, stake, odds, line, name)`; posts to `POST /api/mcp/bets/quick-create`. Parlay limitation documented in docstring.
- **`search_teams` fixed**: Now calls `GET /api/mcp/teams/search?q=<query>` (real backend endpoint) instead of the previous non-functional route.
- **`get_active_games`** → `GET /api/mcp/games`
- **`get_my_bets`** → `GET /api/mcp/bets`
- **`get_bet_details`** → `GET /api/mcp/bets/{bet_id}`
- **`get_game_odds`** → `GET /api/mcp/games/{game_id}/odds`
- **`get_dashboard_stats`** → `GET /api/mcp/bets/summary`
- All tool docstrings updated to reflect actual endpoints, parameters, and response shapes.

---

## [0.2.6] - 2026-05-08

### Added
- **Unified `get_scoreboard(league, date)` tool**: Single entry-point scoreboard tool that
  automatically resolves the ESPN sport type from the league code via a shared
  `LEAGUE_SPORT_MAP` lookup dictionary. Eliminates the need to pass both `sport` and
  `league` for the common use-case. Supported leagues: `nfl`, `nba`, `mlb`, `nhl`,
  `wnba`, `college-football`, `mens-college-basketball`, `womens-college-basketball`.
- **`LEAGUE_SPORT_MAP` constant**: Centralised dictionary mapping league codes to
  (ESPN sport type, display name) tuples, shared across scoreboard tools to prevent
  duplicated hard-coded strings.

### Changed
- `get_formatted_scoreboard` docstring updated to recommend `get_scoreboard(league)` for
  simpler usage.

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
