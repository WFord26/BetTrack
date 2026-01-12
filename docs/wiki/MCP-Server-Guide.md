<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/assets/logo-mcp.png" alt="BetTrack MCP Server" width="200"/>
</div>

# MCP Server Guide

Complete guide to the BetTrack MCP Server - architecture, tools, and development.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Server Components](#server-components)
- [Tool Development](#tool-development)
- [Configuration](#configuration)
- [Formatters](#formatters)
- [Testing](#testing)
- [Building & Packaging](#building--packaging)

---

## Architecture Overview

The BetTrack MCP Server uses the **FastMCP** framework to provide sports data tools to Claude Desktop via stdio transport.

### Key Design Principles

1. **Dual-API Integration**: Combines The Odds API (betting data) with ESPN API (stats/schedules)
2. **Natural Language Search**: Fuzzy team name matching for intuitive queries
3. **Rich Formatting**: ASCII cards, Markdown tables, and visual scoreboards
4. **Async/Await Pattern**: All API calls are asynchronous for performance
5. **Round-Robin API Keys**: Supports multiple API keys to distribute quota

### Technology Stack

```
FastMCP Framework
├── aiohttp - Async HTTP client
├── Python 3.11+ - Type hints and async features
├── stdio transport - Claude Desktop communication
└── MCPB packaging - Distribution format
```

---

## Server Components

### Core Files

#### `sports_mcp_server.py`
Main server entry point with all tool definitions.

**Structure:**
```python
from fastmcp import FastMCP
import asyncio

# Initialize MCP server
mcp = FastMCP("Sports Data MCP")

# API Handlers
odds_handler = OddsAPIHandler(api_key, bookmakers_filter, bookmakers_limit)
espn_handler = ESPNAPIHandler()

# Tool definitions
@mcp.tool()
async def get_odds(sport: str, regions: str = "us", markets: str = "h2h"):
    """Get betting odds for a sport"""
    # Implementation
    
# Server startup
if __name__ == "__main__":
    mcp.run()
```

**Total Tools**: 30+ decorated with `@mcp.tool()`

#### `sports_api/odds_api_handler.py`
Handles all interactions with The Odds API.

**Key Features:**
- Round-robin API key rotation
- Usage tracking (logs `x-requests-remaining`)
- Bookmaker filtering
- Session management

**Example:**
```python
class OddsAPIHandler:
    def __init__(self, api_key: Union[str, List[str]], 
                 bookmakers_filter: List[str], 
                 bookmakers_limit: int):
        self.api_keys = [api_key] if isinstance(api_key, str) else api_key
        self.current_key_index = 0
        
    async def _make_request(self, endpoint: str, params: Dict) -> Dict:
        # Round-robin key selection
        api_key = self.api_keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        # Make request
```

#### `sports_api/espn_api_handler.py`
Handles all ESPN API calls (no authentication required).

**Endpoints:**
- Site API: `https://site.api.espn.com` (news, schedule)
- Core API: `https://sports.core.api.espn.com` (stats, standings)
- CDN: `https://cdn.espn.com` (team logos)

#### `sports_api/formatter.py`
Output formatting utilities (574 lines).

**Functions:**
- `format_matchup_card()` - ASCII box-drawing cards (66 char width)
- `format_scoreboard_table()` - Markdown tables with emoji indicators
- `format_detailed_scoreboard()` - Quarter-by-quarter breakdowns
- `format_standings_table()` - Conference/division standings
- `format_odds_comparison()` - Side-by-side bookmaker odds

#### `sports_api/team_reference.py`
Hardcoded team dictionaries for NFL, NBA, NHL (216 lines).

**Functions:**
- `find_team_id(team_name: str, sport: str)` - Fuzzy match team to ESPN ID
- `get_team_logo_url(team_name: str, sport: str, dark_mode: bool)` - Generate CDN URLs

---

## Tool Development

### Tool Registration Pattern

All tools use the `@mcp.tool()` decorator:

```python
@mcp.tool()
async def search_odds(
    query: str, 
    sport: Optional[str] = None, 
    markets: str = "h2h"
) -> dict:
    """
    Search for odds by team name or matchup (natural language).
    
    Args:
        query: Team name or matchup (e.g., "Lakers vs Celtics")
        sport: Sport key (optional, searches all if omitted)
        markets: Comma-separated markets (h2h,spreads,totals)
    
    Returns:
        {"success": bool, "data": [...], "error": str}
    """
    try:
        # Implementation
        result = await odds_handler.search_odds(query, sport, markets)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Return Value Convention

**Always return a dict with this structure:**
```python
{
    "success": True,        # or False
    "data": { ... },        # Only on success
    "error": "message"      # Only on failure
}
```

### Natural Language Search

Tools use fuzzy matching for team names:

```python
from difflib import get_close_matches

def find_team_id(team_name: str, sport: str) -> Optional[str]:
    """Fuzzy match team name to ESPN ID"""
    team_dict = {
        "nba": NBA_TEAMS,
        "nfl": NFL_TEAMS,
        "nhl": NHL_TEAMS
    }.get(sport)
    
    if not team_dict:
        return None
    
    # Try exact match first
    if team_name in team_dict:
        return team_dict[team_name]["id"]
    
    # Fuzzy match
    matches = get_close_matches(team_name, team_dict.keys(), n=1, cutoff=0.6)
    return team_dict[matches[0]]["id"] if matches else None
```

---

## Configuration

### Environment Variables

**Location**: `.env` file in config directory
- **Windows**: `%APPDATA%\Claude\sports-mcp-config\.env`
- **macOS**: `~/Library/Application Support/Claude/sports-mcp-config/.env`
- **Linux**: `~/.config/Claude/sports-mcp-config/.env`

**Variables:**
```bash
# Required for betting odds
ODDS_API_KEY=your_key_here

# Optional: Filter bookmakers (comma-separated)
BOOKMAKERS_FILTER=draftkings,fanduel,betmgm

# Optional: Limit number of bookmakers returned
BOOKMAKERS_LIMIT=5

# Optional: Logging level
LOG_LEVEL=INFO
```

### Round-Robin API Keys (Easter Egg)

Set multiple keys separated by commas:

```bash
ODDS_API_KEY=key1_here,key2_here,key3_here
```

Server logs: `"Easter egg activated! Using 3 API keys in round-robin mode"`

### Claude Desktop Config

**Location**: `%APPDATA%\Claude\config\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sports-data": {
      "command": "python",
      "args": ["C:/path/to/sports_mcp_server.py"],
      "env": {
        "ODDS_API_KEY": "your_key_here",
        "BOOKMAKERS_FILTER": "draftkings,fanduel",
        "BOOKMAKERS_LIMIT": "3"
      }
    }
  }
}
```

---

## Formatters

### ASCII Card Format

```python
def format_matchup_card(game: Dict) -> str:
    """
    Returns ASCII box-drawing card with centered text.
    Width: 66 characters for consistent display.
    """
    # Example output:
    # ╔════════════════════════════════════════════════════════════════╗
    # ║                      Lakers @ Celtics                          ║
    # ║                   Wed, Jan 15 • 7:30 PM ET                     ║
    # ╟────────────────────────────────────────────────────────────────╢
    # ║  Score: Lakers 98 - Celtics 105 (Final)                        ║
    # ╚════════════════════════════════════════════════════════════════╝
```

### Markdown Table Format

```python
def format_scoreboard_table(games: List[Dict]) -> str:
    """
    Returns Markdown table with emoji status indicators.
    """
    # Example output:
    # | Status | Away | Home | Time |
    # |--------|------|------|------|
    # | 🔴 Live | Lakers 98 | Celtics 105 | Q4 2:34 |
    # | ⏰ Scheduled | Heat | Bulls | 7:30 PM ET |
    # | ✅ Final | Warriors 110 | Nets 102 | Final |
```

### Intelligent Name Shortening

```python
def shorten_team_name(name: str, max_length: int) -> str:
    """
    Preserve last word (team nickname) when shortening.
    
    Examples:
    - "Los Angeles Lakers" → "LA Lakers" (preserve "Lakers")
    - "Golden State Warriors" → "GS Warriors" (preserve "Warriors")
    """
```

---

## Testing

### Current State

No automated tests yet. Manual testing via Claude Desktop.

### Recommended Test Structure

```bash
mcp/tests/
├── test_odds_api_handler.py      # Mock Odds API responses
├── test_espn_api_handler.py      # Mock ESPN API responses
├── test_formatters.py             # Test output formatting
├── test_team_reference.py         # Test fuzzy matching
├── test_mcp_tools.py              # Integration tests
└── conftest.py                    # Shared fixtures
```

### Setup Pytest

```bash
# Install dependencies
pip install pytest pytest-asyncio pytest-mock aioresponses

# Run tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=sports_api --cov-report=html
```

### Example Test

```python
# test_formatters.py
import pytest
from sports_api.formatter import format_matchup_card

def test_matchup_card_width():
    """Ensure all cards are exactly 66 characters wide"""
    game = {
        "home_team": "Los Angeles Lakers",
        "away_team": "Boston Celtics",
        "commence_time": "2026-01-15T19:30:00Z"
    }
    card = format_matchup_card(game)
    lines = card.split("\n")
    assert all(len(line) == 66 for line in lines)
```

---

## Building & Packaging

### Build Script

**Location**: `scripts/build.ps1`

```powershell
# Navigate to scripts directory
cd scripts

# Build MCP server package
.\build.ps1 -VersionBump patch

# Beta build (git hash versioning)
.\build.ps1 -Beta

# Full release (version bump + GitHub release)
.\build.ps1 -VersionBump minor -Release
```

### Build Flags

- `-VersionBump <patch|minor|major>` - Bump semantic version
- `-Beta` - Create beta version with git hash
- `-Release` - Create GitHub release and push tag
- `-Clean` - Remove build artifacts

### Output

MCPB packages saved to `mcp/releases/`:
```
sports-data-mcp-v0.1.13.mcpb
sports-data-mcp-v0.1.14-beta.928845c.mcpb
```

### MCPB Format

MCPB is a ZIP archive with `.mcpb` extension containing:
```
sports-data-mcp.mcpb (ZIP)
├── sports_mcp_server.py
├── manifest.json
├── requirements.txt
├── sports_api/
│   ├── odds_api_handler.py
│   ├── espn_api_handler.py
│   ├── formatter.py
│   └── team_reference.py
└── .env.example
```

### Manifest Structure

`manifest.json`:
```json
{
  "name": "sports-data-mcp",
  "version": "0.1.13",
  "description": "Sports betting odds and game data MCP server",
  "author": "Your Name",
  "license": "MIT",
  "entry_point": "sports_mcp_server.py",
  "python_version": ">=3.11",
  "dependencies": [
    "fastmcp>=0.1.0",
    "aiohttp>=3.9.0"
  ]
}
```

---

## API Handler Pattern

### Session Management

```python
class OddsAPIHandler:
    def __init__(self, api_key, bookmakers_filter, bookmakers_limit):
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Lazy session creation, reuses existing"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
        
    async def close(self):
        """Clean up session"""
        if self._session and not self._session.closed:
            await self._session.close()
```

### Error Handling

```python
async def _make_request(self, endpoint: str, params: Dict) -> Dict:
    """Make API request with error handling"""
    try:
        session = await self._get_session()
        async with session.get(url, params=params) as response:
            if response.status == 200:
                return await response.json()
            elif response.status == 429:
                raise Exception("API rate limit exceeded")
            else:
                raise Exception(f"API error: {response.status}")
    except aiohttp.ClientError as e:
        raise Exception(f"Network error: {str(e)}")
```

---

## Common Patterns

### Bookmaker Filtering

Reduce API response size by filtering to preferred sportsbooks:

```python
def filter_bookmakers(odds: List[Dict], bookmakers: List[str], limit: int) -> List[Dict]:
    """Filter and limit bookmakers"""
    filtered = [b for b in odds if b["key"] in bookmakers] if bookmakers else odds
    return filtered[:limit]
```

### Team Logo URLs

Generate ESPN CDN URLs for team logos:

```python
def get_team_logo_url(team_name: str, sport: str, dark_mode: bool = False) -> str:
    """
    Returns: https://a.espncdn.com/i/teamlogos/{sport}/500/{team_id}.png
    
    Dark mode available for some sports (adds /dark/ to path)
    """
    team_id = find_team_id(team_name, sport)
    if not team_id:
        return None
    
    base = "https://a.espncdn.com/i/teamlogos"
    dark = "/dark" if dark_mode else ""
    return f"{base}/{sport}{dark}/500/{team_id}.png"
```

---

## Performance Tips

1. **Use async/await**: All API calls should be async
2. **Reuse sessions**: Don't create new ClientSession for each request
3. **Limit bookmakers**: Use `BOOKMAKERS_LIMIT` to reduce response size
4. **Cache lookups**: Team ID lookups can be cached (static data)
5. **Batch requests**: Use `asyncio.gather()` for parallel API calls

Example parallel requests:
```python
# Fetch multiple sports odds simultaneously
results = await asyncio.gather(
    odds_handler.get_odds("basketball_nba"),
    odds_handler.get_odds("americanfootball_nfl"),
    odds_handler.get_odds("icehockey_nhl")
)
```

---

## Troubleshooting

### Common Issues

**Issue**: Tools not showing in Claude Desktop
- **Solution**: Restart Claude Desktop after installation
- **Check**: Verify manifest.json has correct entry_point

**Issue**: API key not working
- **Solution**: Check .env file location (config directory, not install directory)
- **Check**: Verify no extra spaces in ODDS_API_KEY value

**Issue**: Rate limit errors
- **Solution**: Use round-robin API keys or upgrade to paid tier
- **Check**: Monitor `x-requests-remaining` in logs

**Issue**: Team not found errors
- **Solution**: Check team name spelling, try abbreviation (e.g., "LAL" instead of "Lakers")
- **Check**: Verify sport is supported in team_reference.py

---

## Next Steps

- [Frontend Documentation](Frontend-Guide)
- [Backend API Reference](Backend-Guide)
- [Database Schema](Database-Guide)
- [Quick Start Guide](Quick-Start)
