# Testing AI Bet Creation

## Overview

The AI bet creation endpoint uses a **game ID-based workflow** for reliability:
1. Get available games with their IDs using `GET /api/games` or MCP `get_active_games()`
2. Select specific games by their UUIDs
3. Create bets with those exact game IDs

This eliminates fuzzy matching errors and ensures bets are placed on the correct games.

## Quick Test with curl

### Step 1: Create an API Key

Create an API key in the dashboard at http://localhost:5173/settings/api-keys

### Step 2: Get Available Games

```bash
# Get today's games (includes game IDs)
curl http://localhost:3001/api/games | jq '.games[] | {id, homeTeamName, awayTeamName, sportName}'

# Example output:
# {
#   "id": "fc14adda-641a-4ef6-9567-0b1d1110affb",
#   "homeTeamName": "Orlando Magic",
#   "awayTeamName": "New Orleans Pelicans",
#   "sportName": "NBA"
# }
```

### Step 3: Create Bet with Game ID

```bash
# Single bet on specific game
curl -X POST http://localhost:3001/api/ai/bets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "selections": [
      {
        "gameId": "fc14adda-641a-4ef6-9567-0b1d1110affb",
        "type": "spread",
        "selection": "away",
        "odds": -110,
        "line": -6,
        "teamName": "New Orleans Pelicans"
      }
    ],
    "betType": "single",
    "stake": 25.00,
    "notes": "Pelicans covering the spread"
  }'

# Parlay bet on multiple games
curl -X POST http://localhost:3001/api/ai/bets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "selections": [
      {
        "gameId": "fc14adda-641a-4ef6-9567-0b1d1110affb",
        "type": "spread",
        "selection": "home",
        "odds": -110,
        "line": 6,
        "teamName": "Orlando Magic"
      },
      {
        "gameId": "035014f9-263c-4eb2-a00f-5186afc55c5b",
        "type": "moneyline",
        "selection": "away",
        "odds": -275,
        "teamName": "Brooklyn Nets"
      }
    ],
    "betType": "parlay",
    "stake": 20.00,
    "notes": "2-leg parlay bet"
  }'
```

## Expected Response

```json
{
  "success": true,
  "bet": {
    "id": "35e44a5a-d3f2-45ba-b398-52a4eeec8d9c",
    "name": "Pelicans covering the spread",
    "betType": "single",
    "stake": "25",
    "potentialPayout": "22.73",
    "status": "pending",
    "legs": [
      {
        "id": "bf3bf745-7e49-4ca8-8ebe-f8c944a5a579",
        "gameId": "fc14adda-641a-4ef6-9567-0b1d1110affb",
        "selectionType": "spread",
        "selection": "away",
        "line": "-6",
        "odds": -110,
        "status": "pending",
        "game": {
          "homeTeamName": "Orlando Magic",
          "awayTeamName": "New Orleans Pelicans",
          "sportName": "NBA"
        }
      }
    ]
  },
  "message": "Bet created successfully"
}
```

## Error Cases

### Game ID not found
```json
{
  "success": false,
  "error": "Some game IDs not found",
  "details": {
    "requestedGames": 2,
    "foundGames": 1,
    "missingGameIds": ["invalid-uuid-here"]
  }
}
```

### Invalid API key
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### Missing required fields
```json
{
  "success": false,
  "error": "selections array is required"
}
```

## MCP Server Testing

### 1. Setup Claude Desktop Config

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sports-dashboard": {
      "command": "python",
      "args": ["C:/Users/wford.MS/GitHub/Sports-Odds-MCP/mcp/dashboard_mcp_server.py"],
      "env": {
        "DASHBOARD_API_KEY": "YOUR_API_KEY_HERE",
        "DASHBOARD_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 2. Restart Claude Desktop

### 3. Test with Game ID Workflow

**Recommended workflow:**

**User:** "Show me today's NBA games"
- Claude calls `get_active_games(sport="basketball_nba")`
- Returns games with IDs, teams, odds

**User:** "Create a $25 bet on the Pelicans spread from the first game"
- Claude calls `create_bet()` with the specific game ID from previous results
- No ambiguity, exact game matching

**User:** "Show my pending bets"
- Claude calls `get_my_bets(status="pending")`

### 4. Example MCP Tool Call

```python
# Claude automatically does this:
games = get_active_games(sport="basketball_nba")
# Gets: [{"id": "fc14adda...", "homeTeamName": "Orlando Magic", "awayTeamName": "New Orleans Pelicans"}]

create_bet(
    selections=[{
        "gameId": "fc14adda-641a-4ef6-9567-0b1d1110affb",  # From get_active_games
        "type": "spread",
        "selection": "away",
        "odds": -110,
        "line": -6,
        "teamName": "New Orleans Pelicans"
    }],
    bet_type="single",
    stake=25.00,
    notes="Pelicans covering the spread"
)
```

## Debugging

### Backend logs
```bash
docker-compose logs backend --tail=50 -f
```

### Check API key usage
Go to dashboard → Settings → API Keys → View key details

### MCP server logs
Check Claude Desktop logs:
- Windows: `%APPDATA%\Claude\logs\mcp*.log`

### Verify game IDs
```bash
# Get games and their IDs
curl http://localhost:3001/api/games | jq '.games[] | {id, homeTeamName, awayTeamName}'
```

## Request Format

### AiBetSelection Object
```typescript
{
  gameId: string;          // UUID from get_active_games()
  type: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;            // American odds (e.g., -110, +150)
  line?: number;           // Spread/total line (e.g., -3.5, 215.5)
  teamName?: string;       // Optional display name
}
```

### AiBetRequest Body
```typescript
{
  selections: AiBetSelection[];  // Array of selections with game IDs
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;                 // Dollar amount
  teaserPoints?: number;         // For teaser bets
  notes?: string;                // Optional notes
  source?: 'mcp' | 'image' | 'text' | 'conversation';
}
```

## Next Steps

1. ✅ Test API key creation
2. ✅ Test curl commands with game IDs
3. ⏳ Configure Claude Desktop MCP
4. ⏳ Test Claude → MCP → Dashboard flow
5. ⏳ Test with real game data
