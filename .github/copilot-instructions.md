# Sports-Odds-MCP - AI Agent Instructions

## Project Overview
FastMCP server providing sports data from The Odds API (betting odds) and ESPN API (games, teams, stats) for Claude Desktop. Includes optional web dashboard (React + Node.js) for bet tracking. Single Python server with dual data sources and rich formatting tools.

## Project Structure
```
Sports-Odds-MCP/
├── mcp/                        # MCP server (Python FastMCP)
│   ├── sports_mcp_server.py    # Main server entry point
│   ├── sports_api/             # API handlers and formatters
│   ├── scripts/build/          # PowerShell build system
│   └── releases/               # Built MCPB packages
├── dashboard/                  # Optional web dashboard
│   ├── backend/                # Node.js + TypeScript + Prisma
│   └── frontend/               # React + Vite + Redux
└── docs/                       # Documentation
```

## Architecture Fundamentals

### Dual-API Design
- **MCP Server** (`mcp/sports_mcp_server.py`): FastMCP framework, stdio transport for Claude Desktop
- **Odds API Handler** (`mcp/sports_api/odds_api_handler.py`): Betting odds, scores, live lines
- **ESPN API Handler** (`mcp/sports_api/espn_api_handler.py`): Teams, scoreboards, standings, schedules
- **Formatters** (`mcp/sports_api/formatter.py`): Markdown tables, ASCII cards, visual scoreboards
- **Team Reference** (`mcp/sports_api/team_reference.py`): Team ID lookups, logo URLs for NFL/NBA/NHL

### Dashboard (Optional Web Component)
- **Backend** (`dashboard/backend/`): Node.js + Express + TypeScript + Prisma
  - **Routes**: games (timezone-aware filtering), bets, admin, mcp integration
  - **Services**: odds-sync (background), bet-service, outcome-resolver (background)
  - **Scheduled Jobs**: node-cron for automatic odds sync and outcome resolution
  - **API Features**: Background job execution, rate limit tracking, timezone handling
- **Frontend** (`dashboard/frontend/`): React + Vite + Redux Toolkit + Tailwind CSS
- **Purpose**: Web UI for bet tracking, odds history, line movement charts
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: Redux Toolkit with slices (betSlip)
- **Testing**: Jest + Prisma integration tests

### Key Configuration
- **Single config source**: `.env` file (supports `.env.example` template)
- **Required**: `ODDS_API_KEY` (get from https://the-odds-api.com)
- **Optional**: `BOOKMAKERS_FILTER` (comma-separated, e.g., `draftkings,fanduel,betmgm`)
- **Optional**: `BOOKMAKERS_LIMIT` (default: 5 bookmakers per game)
- **Optional**: `LOG_LEVEL` (DEBUG, INFO, WARNING, ERROR, CRITICAL)

## Critical Development Workflows

### Pre-Push Build Verification

**IMPORTANT**: Always run build scripts before pushing changes to ensure production builds succeed.

**Build Script Location**: `scripts/build.ps1` (centralized build system)

```powershell
# Navigate to build script directorycd scripts

# Build MCP Server MCPB package only
.\build.ps1 -VersionBump patch  # or -Beta for testing

# Build Dashboard only (backend + frontend)
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Build everything (MCP + Dashboard)
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend

# Beta build with version bumps
.\build.ps1 -Dashboard -BumpDashboard -BumpBackend -BumpFrontend -VersionBump patch -Beta

# Verify build outputs
ls ../../releases/  # Check for new .mcpb file
ls ../../../dashboard/dist/backend/  # Check for compiled JS files
ls ../../../dashboard/dist/frontend/  # Check for bundled assets
```

**Build verification checklist**:
- [ ] MCP server builds without errors (`scripts/build.ps1`)
- [ ] Backend TypeScript compiles (`npm run build` in dashboard/backend/)
- [ ] Frontend bundles successfully (`npm run build` in dashboard/frontend/)
- [ ] No TypeScript errors (`npm run type-check` if available)
- [ ] Tests pass (if applicable)
- [ ] Version numbers updated in manifest.json and package.json files

**When to build**:
- Before every commit that changes MCP server code
- Before every commit that changes dashboard backend/frontend
- After updating dependencies (package.json, requirements.txt)
- Before creating pull requests
- Before tagging releases

### Build System (PowerShell)
**Location**: `scripts/build.ps1` (centralized for MCP + Dashboard)

```powershell
# Navigate to build script
cd scripts

# Build MCP MCPB package only
.\build.ps1 -VersionBump patch

# Build Dashboard only (backend + frontend to dist/)
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Build everything (MCP + Dashboard)
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend

# Beta build (uses git hash or incremental numbering)
.\build.ps1 -Beta  # MCP only
.\build.ps1 -Dashboard -Beta -BumpDashboard  # Dashboard beta

# Full release (version bump + GitHub release + git tag)
.\build.ps1 -VersionBump minor -Release

# Clean build artifacts
.\build.ps1 -Clean
```

**Build Flags**:
- `-VersionBump <patch|minor|major>`: Bump MCP server version
- `-Dashboard`: Build dashboard components
- `-BumpDashboard`: Bump dashboard root package.json version
- `-BumpBackend`: Bump backend/package.json version
- `-BumpFrontend`: Bump frontend/package.json version
- `-Beta`: Create beta version (git hash or incremental)
- `-Release`: Create GitHub release and push tag
- `-Clean`: Remove build artifacts

**Version Management**:
- `-VersionBump`: Updates MCP `manifest.json` and `package.json`
- `-BumpDashboard`: Updates dashboard root `package.json`
- `-BumpBackend`: Updates `dashboard/backend/package.json`
- `-BumpFrontend`: Updates `dashboard/frontend/package.json`
- Beta builds use git commit hash: `v0.1.13-beta.928845c`
- Beta with version bump: incremental beta numbering (`v0.1.14-beta.1`)
- Release flag creates git tag and pushes to GitHub
- Beta releases NOT pushed to GitHub (local testing only)

**Build Output**:
- **MCP**: MCPB packages saved to `mcp/releases/sports-data-mcp-v{version}.mcpb`
  - MCPB format: ZIP archive with `.mcpb` extension
  - Contains: server script, API handlers, formatters, manifest, requirements.txt
- **Dashboard Backend**: Compiled TypeScript to `dashboard/dist/backend/`
- **Dashboard Frontend**: Bundled React app to `dashboard/dist/frontend/`


### Local Development Setup
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "sports-data-local": {
      "command": "python",
      "args": ["C:/path/to/Sports-Odds-MCP/src/sports_mcp_server.py"],
      "env": {
        "ODDS_API_KEY": "your_api_key_here",
        "BOOKMAKERS_FILTER": "draftkings,fanduel",
        "BOOKMAKERS_LIMIT": "3"
      }
    }
  }
}
```

**Key Behavior**:
- First run creates `.env`src/` directory for `.env` if `SPORTS_MCP_CONFIG_DIR` not set
- All development work happens in `src/` folder (MCP server code)
- Config directory: `${APPDATA}/Claude/sports-mcp-config` (survives updates)
- Development mode: Uses script directory for `.env` if `SPORTS_MCP_CONFIG_DIR` not set

### Dashboard Development
```bash
# Backend setup (dashboard/backend/)
npm install
cp .env.example .env  # Add DATABASE_URL, ODDS_API_KEY
npm run prisma:migrate
npm run prisma:generate
npm run dev  # Runs on http://localhost:3001

# Frontend setup (dashboard/frontend/)
npm install
npm run dev  # Runs on http://localhost:5173

# Database utilities
npm run prisma:studio  # Visual database browser
npm run init:sports    # Seed sports/leagues via admin API
npm run sync:odds      # Manual odds sync via admin API (background)
npm run resolve:outcomes  # Resolve bet outcomes via admin API (background)

# Build for production (REQUIRED before push)
# Use centralized build script:
cd ../../mcp/scripts/build
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend
# Outputs: dashboard/dist/backend/ and dashboard/dist/frontend/
```

**Admin API Endpoints** (`/api/admin`):
- `POST /init-sports` - Initialize 7 sports (NFL, NBA, NCAAB, NHL, MLB, EPL, UEFA)
- `POST /sync-odds` - Manual odds sync (runs in background, optional `sportKey` param)
- `POST /resolve-outcomes` - Manual bet settlement (runs in background)
- `GET /stats` - Database statistics (counts, active sports, recent games)
- `GET /health` - Detailed health check with DB connectivity test

### Testing Approach

#### MCP Server Testing
**Current State**: No automated tests yet. Recommended approach:

**Location**: Create `mcp/tests/` directory

```bash
# Install test dependencies (from mcp/ directory)
cd mcp
pip install pytest pytest-asyncio pytest-mock aioresponses

# Recommended test structure
mcp/tests/
  test_odds_api_handler.py     # Mock Odds API responses
  test_espn_api_handler.py     # Mock ESPN API responses
  test_formatters.py           # Test output formatting
  test_team_reference.py       # Test fuzzy matching
  test_mcp_tools.py            # Integration tests for @mcp.tool() functions
  conftest.py                  # Shared fixtures

# Run tests
cd mcp
pytest tests/ -v
pytest tests/ --cov=sports_api --cov-report=html
```

### Tool Registration (MCP)
All MCP tools are decorated methods in main server file (`mcp/sports_mcp_server.py`):
```python
@mcp.tool()
async def search_odds(query: str, sport: Optional[str] = None, markets: str = "h2h") -> dict:
    """Search for odds by team name or matchup (natural language)"""
    # Natural language search with fuzzy matching
```

**30+ total tools**: Odds retrieval (5), formatted output (7), ESPN data (12), team utilities (3), visual scoreboards (3+).
**File**: `mcp/sports_mcp_server.py` (lines 130-1310)

### API Handler Pattern
Both API handlers follow consistent async/session pattern:
```python
class OddsAPIHandler:
    def __init__(self, api_key: Union[str, List[str]], bookmakers_filter, bookmakers_limit):
        # Supports single API key OR list for round-robin
        # Round-robin cycles through keys to distribute quota
        
    async def _get_session(self) -> aiohttp.ClientSession:
        # Lazy session creation, reuses existing
        
    async def _make_request(self, endpoint: str, params: Dict) -> Dict:
        # Adds API key, handles errors, logs rate limits
```

**Key features**:
- Round-robin API key rotation: Pass list to constructor, logs "Easter egg activated!" message
- Bookmaker filtering: Reduces API response size, focuses on preferred sportsbooks
- Usage tracking: Logs `x-requests-remaining` header from Odds API responses

### Formatter Convention
All formatters return plain strings (Markdown or ASCII art) (`mcp/sports_api/formatter.py`):
```python
def format_matchup_card(game: Dict) -> str:
    """
    Returns ASCII box-drawing card with centered text.
    Width: 66 characters for consistent display.
    Intelligently shortens team names (preserve last word like "Lakers").
    """
```

**File**: `mcp/sports_api/formatter.py` (574 lines)

**Output types**:
- `format_matchup_card()`: Single game ASCII card with scores, time, broadcasts
- `format_scoreboard_table()`: Markdown table with emoji status indicators
- `format_detailed_scoreboard()`: Quarter-by-quarter breakdown
- `format_standings_table()`: Conference/division standings with win percentages
- `format_odds_comparison()`: Side-by-side bookmaker odds comparison

### Team Reference Lookups
Three hardcoded team dictionaries (`mcp/sports_api/team_reference.py`):
```python
NFL_TEAMS = {"Arizona Cardinals": {"id": "22", "abbr": "ARI", "division": "NFC West"}, ...}
NBA_TEAMS = {"Atlanta Hawks": {"id": "1", "abbr": "ATL", "division": "Southeast"}, ...}
NHL_TEAMS = {"Anaheim Ducks": {"id": "25", "abbr": "ANA", "division": "Pacific"}, ...}

def find_team_id(team_name: str, sport: str) -> Optional[str]:
    """Fuzzy match team name to ESPN ID for API calls"""
    
def get_team_logo_url(team_name: str, sport: str, dark_mode: bool = False) -> Optional[str]:
    """Generate ESPN CDN logo URL (500px PNG format)"""
```

**File**: `mcp/sports_api/team_reference.py` (216 lines)

### Changelog Management

**Three-Tier Changelog Strategy**:

#### 1. Component Changelogs (Semantic Versioning)
Component-specific changelogs use **semantic versioning** (MAJOR.MINOR.PATCH) and track detailed changes during development:

- **MCP Server**: `mcp/CHANGELOG.md`
  - Update when changing tools, API handlers, formatters, or MCP server behavior
- **Dashboard Backend**: `dashboard/backend/CHANGELOG.md`
  - Update when changing API routes, services, database schema, or backend logic
- **Dashboard Frontend**: `dashboard/frontend/CHANGELOG.md`
  - Update when changing UI components, Redux store, charts, or frontend features

**Semantic Versioning Rules**:
```markdown
## [Unreleased]

### Added
- New features, tools, components, or capabilities

### Changed
- Modifications to existing functionality
- Breaking changes (prefix with `BREAKING:`)

### Fixed
- Bug fixes and corrections

### Security
- Security-related changes
```

**When to update component changelogs**:
- During development, update the relevant component's `## [Unreleased]` section
- On version release, build scripts move `[Unreleased]` to versioned section (e.g., `## [1.2.3]`)
- Semantic version bumping: MAJOR (breaking), MINOR (features), PATCH (fixes)

#### 2. Root Changelog (Date-Based Versioning)
The root changelog (`CHANGELOG.md`) uses **date-based versioning** (YYYY-MM-DD) and contains only **high-level release summaries**:

```markdown
## [2026-01-15]

### Release Summary
High-level description of what changed in this release across all components.

### Component Versions
- MCP Server: v1.2.3
- Dashboard Backend: v2.1.0
- Dashboard Frontend: v2.1.1
```

**Root changelog rules**:
- **Only update on releases** (not during development)
- Focus on user-facing changes and major features
- Include component version references
- Use date-based section headers: `## [YYYY-MM-DD]`
- Keep entries brief (2-5 bullet points per release)

**Update workflow**:
1. During development: Update component changelogs (`mcp/`, `dashboard/backend/`, `dashboard/frontend/`)
2. On release: Update root `CHANGELOG.md` with high-level summary and component versions
3. Release command: `.\build.ps1 -FullRelease -VersionBump patch -PushDocker`

### Markets System (Betting)
**Game Markets**: `h2h` (moneyline), `spreads`, `totals`, `outrights`

**Player Props** (70+ markets across NFL/NBA/NHL/MLB):
- **NBA**: `player_points`, `player_rebounds`, `player_assists`, `player_threes`, `player_blocks`, `player_steals`, `player_double_double`, `player_triple_double`, combos
- **NFL**: `player_pass_tds`, `player_pass_yds`, `player_rush_yds`, `player_receptions`, `player_reception_yds`, `player_anytime_touchdown`, `player_first_touchdown`, kicking, defense
- **MLB**: `player_home_runs`, `player_hits`, `player_strikeouts`, `player_rbis`, `player_stolen_bases`, pitcher props
- **NHL**: `player_points`, `player_shots_on_goal`, `player_blocked_shots`, `player_saves`, `player_goals`

**Usage**: Combine markets in single query: `markets="h2h,spreads,player_points,player_rebounds"`

## Integration Points

### The Odds API
- **Authentication**: Query parameter `apiKey`
- **Base URL**: `https://api.the-odds-api.com`
- **Rate Limits**: Free tier (500 requests/month), paid tiers available
- **Usage tracking**: Response header `x-requests-remaining` logged automatically

### ESPN API
- **Public endpoints**: No authentication required
- **Base URLs**: 
  - Site API: `https://site.api.espn.com`
  - Core API: `https://sports.core.api.espn.com`
  - CDN: `https://cdn.espn.com` (logos)
- **Rate Limits**: None enforced (public API, use respectfully)

### Backend REST API Patterns

**Timezone-Aware Date Filtering**:
The `/api/games` endpoint accepts a `timezoneOffset` parameter (minutes) to correctly filter games by date in the user's local timezone:

```typescript
// Example: User in MST (UTC-7) requests games for Jan 9
GET /api/games?date=2026-01-09&timezoneOffset=420

// Backend converts to UTC range:
// startOfDayUTC: 2026-01-09T07:00:00Z
// endOfDayUTC: 2026-01-10T06:59:59Z
```

**Background Job Execution**:
Admin endpoints (`/api/admin/sync-odds`, `/api/admin/resolve-outcomes`) run long operations asynchronously to prevent API timeouts. Check logs for completion status.

**Enhanced Response Format**:
Game objects include flattened `sportKey` and `sportName` fields alongside nested `sport` object for easier frontend consumption.

### Dashboard Database (Prisma Schema)
```prisma
model Sport {
  key       String @id  // "basketball_nba"
  title     String
  group     String
  active    Boolean
}

model Team {
  id        String @id
  espnId    String
  name      String
  abbr      String
  sport     String
  logoUrl   String?
}

model Game {
  id           String @id @default(uuid())
  externalId   String @unique  // Odds API event_id
  sport        String
  homeTeam     Team @relation("HomeGames")
  awayTeam     Team @relation("AwayGames")
  commenceTime DateTime
  completed    Boolean
}

model OddSnapshot {
  // Tracks line movement over time
  gameId       String
  bookmaker    String
  marketType   String  // "h2h", "spreads", "totals"
  price        Float
  point        Float?  // For spreads/totals
  timestamp    DateTime
}
```

## Common Pitfalls

1. **Config directory behavior**: On first install, `.env` created from `.env.example`. Updates don't overwrite user's API key (config directory separate from installation).

2. **Bookmaker filtering**: Empty `BOOKMAKERS_FILTER` means ALL bookmakers. To limit without filtering, use `BOOKMAKERS_LIMIT` only.

3. **ESPN scoreboard verbosity**: `get_espn_scoreboard()` returns massive JSON. Use `get_formatted_scoreboard()` or `get_visual_scoreboard()` for human-readable output.

4. **Team ID lookups**: ESPN uses numeric IDs, Odds API uses team names. Use `find_team_id()` for cross-API queries.

5. **Beta versioning**: `-Beta` flag without `-VersionBump` uses git hash. `-Beta` with `-VersionBump` uses incremental numbering.

6. **Round-robin API keys**: Set as comma-separated string: `ODDS_API_KEY=key1,key2,key3`. Logs "Easter egg" message on startup.

7. **Python version**: Requires 3.11+ (FastMCP dependency, type hints, asyncio features).

8. **Dashboard independence**: Dashboard is optional. MCP server works standalone without Node.js/Prisma.

9. **Timezone filtering**: Always pass `timezoneOffset` (minutes) when filtering games by date to ensure accurate results in user's local timezone.

10. **Admin background jobs**: Sync and resolve endpoints return immediately but process asynchronously. Monitor logs or use `/admin/stats` to check progress.

11. **Build before push**: Always run build scripts before pushing. TypeScript errors and bundling issues must be caught locally, not in CI/CD. Check `dist/` folders to verify successful builds.

## Quick Reference Commands
```bash
# Start MCP server (development)
cd mcp
python sports_mcp_server.py

# Build MCP server MCPB package (REQUIRED before push)
cd scripts
.\build.ps1 -VersionBump patch

# Build dashboard to dist/ (REQUIRED before push)
cd scripts
.\build.ps1 -Dashboard -BumpBackend -BumpFrontend

# Build everything (MCP + Dashboard)
cd scripts
.\build.ps1 -Dashboard -VersionBump patch -BumpBackend -BumpFrontend

# Dashboard backend
cd dashboard/backend
npm run dev

# Dashboard frontend
cd dashboard/frontend
npm run dev

# Admin operations (requires backend running)
curl -X POST http://localhost:3001/api/admin/init-sports
curl -X POST http://localhost:3001/api/admin/sync-odds
curl http://localhost:3001/api/admin/stats
curl http://localhost:3001/api/admin/health

# Generate team logo URL
cd mcp
python -c "from sports_api.team_reference import get_team_logo_url; print(get_team_logo_url('Lakers', 'nba'))"

# Check installed tools count
cd mcp
python -c "import sports_mcp_server; print(len([attr for attr in dir(sports_mcp_server.mcp) if attr.startswith('tool_')]))"
```

## File Naming Patterns
- `*_handler.py`: API client wrappers
- `*_server.py`: Server entry points
- `formatter.py`: Output formatting utilities
- `team_reference.py`: Static data lookups
- `.env.example`: Config template (user copies to `.env`)
- `*.mcpb`: Built package files (ZIP archives)
- `.mcpbignore`: Build exclusion rules (like `.gitignore`)

## Documentation Structure
- `docs/AVAILABLE-TOOLS.md`: Complete tool reference with all 30+ tools and 70+ betting markets
- `docs/wiki/`: GitHub wiki pages (Installation Guide, Home)
- `docs/internal/`: Agent prompts for building dashboard, easter eggs documentation
- `CHANGELOG.md`: Root changelog with date-based versioning (release summaries only)
- `mcp/CHANGELOG.md`: MCP server changelog with semantic versioning
- `dashboard/backend/CHANGELOG.md`: Backend changelog with semantic versioning
- `dashboard/frontend/CHANGELOG.md`: Frontend changelog with semantic versioning
- `README.md`: User-facing installation and usage guide

## Future Workflows (Documented Internally)

See `docs/internal/Dashboard-build.md` for complete AI agent prompts to build dashboard from scratch (15+ sequential prompts covering schema, API routes, services, scheduled jobs, frontend components, Redux store, charts).

Easter eggs documented in `docs/internal/easter-eggs.md` (round-robin API keys, visual scoreboards, etc.).

When implementing new features:
- Follow async/await pattern (all API calls are async)
- Return `{"success": bool, "data": ..., "error": ...}` dict structure
- Add tool to `sports_mcp_server.py` with `@mcp.tool()` decorator
- Update `docs/AVAILABLE-TOOLS.md` with new tool documentation
- Add changelog entry under `## [Unreleased]` in relevant component changelog(s)
