# Dashboard MCP Server

MCP server that enables Claude to interact with your Sports Betting Dashboard programmatically.

## Features

- **Create Bets**: Place bets using specific game IDs (no ambiguity)
- **Get Games**: Retrieve active games with IDs and live odds
- **Bet History**: View past bets and performance
- **Statistics**: Track win rate and profit/loss

## Setup

### 1. Install Dependencies

```bash
pip install mcp aiohttp
```

### 2. Generate API Key

1. Open dashboard at http://localhost:5173
2. Click settings (⚙️) → API Keys
3. Create new API key and copy it

### 3. Configure Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sports-dashboard": {
      "command": "python",
      "args": ["c:/path/to/Sports-Odds-MCP/mcp/dashboard_mcp_server.py"],
      "env": {
        "DASHBOARD_API_KEY": "sk_test_your_key_here",
        "DASHBOARD_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

The MCP server will auto-start when Claude launches.

## Available Tools

### create_bet
Create a bet using specific game IDs:
```python
# Step 1: Get games with IDs
games = get_active_games(sport="basketball_nba")

# Step 2: Create bet with specific game ID
create_bet(
    selections=[{
        "gameId": "fc14adda-641a-4ef6-9567-0b1d1110affb",  # From step 1
        "type": "spread",
        "selection": "home",
        "odds": -110,
        "line": -3.5,
        "teamName": "Lakers"
    }],
    bet_type="single",
    stake=10.00,
    notes="Lakers covering at home"
)
```

**Selection fields:**
- `gameId` (required): UUID from `get_active_games()`
- `type`: "moneyline", "spread", or "total"
- `selection`: "home", "away", "over", or "under"
- `odds`: American odds (e.g., -110, +150)
- `line` (optional): Spread/total line (e.g., -3.5, 215.5)
- `teamName` (optional): Display name

### get_active_games
Get games with IDs for betting:
```python
get_active_games(sport="basketball_nba", date="2026-01-10")
```

Returns games with:
- `id`: UUID for creating bets
- `homeTeamName`, `awayTeamName`
- `homeOdds`, `awayOdds` (moneyline, spread, total)
- `commenceTime`, `status`

### get_my_bets
View bet history:
```python
get_my_bets(status="pending")
```

### get_dashboard_stats
View performance metrics:
```python
get_dashboard_stats()
```

## Example Usage in Claude

**User:** "Show me today's NBA games"

**Claude:**
1. Calls `get_active_games(sport="basketball_nba")`
2. Returns formatted list with game IDs, teams, odds

**User:** "Create a $25 bet on the Pelicans spread from game 1"

**Claude:**
1. Uses game ID from previous `get_active_games()` result
2. Calls `create_bet()` with exact game ID
3. Returns bet confirmation (no ambiguity!)

**User:** "Show me my pending bets"

**Claude:** Calls `get_my_bets(status="pending")` and formats results

## Workflow

```
User asks for games
    ↓
get_active_games() returns games with IDs
    ↓
User selects specific games
    ↓
create_bet() uses exact game IDs (no fuzzy matching)
    ↓
Bet created on correct game ✅
```

## Troubleshooting

### "DASHBOARD_API_KEY environment variable not set"
- Ensure API key is set in `claude_desktop_config.json`
- Restart Claude Desktop after changes

### "Connection refused"
- Ensure dashboard backend is running (`docker-compose up`)
- Verify `DASHBOARD_API_URL` matches your backend port

### "Some game IDs not found"
- Game IDs must come from `get_active_games()`
- Games may have expired or been removed
- Call `get_active_games()` again for current games

### API key not working
- Check key hasn't been revoked in dashboard
- Ensure key starts with `sk_test_` or `sk_prod_`
- View usage logs in dashboard settings

## Security

- API keys are required for all requests
- Keys are hashed in database (bcrypt)
- Usage is logged per endpoint
- Revoke keys anytime in dashboard settings
- Keys never expire unless manually revoked
