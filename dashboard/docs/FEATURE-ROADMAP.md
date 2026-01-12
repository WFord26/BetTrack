# Dashboard Feature Roadmap

## Overview
This document outlines the planned features for the Sports Odds Dashboard, including API key management, AI-driven bet creation, and player props betting.

---

## Feature 1: API Key Management for Claude Integration

### Purpose
Allow users to generate API keys that enable Claude (via MCP) to interact with their betting dashboard programmatically.

### Backend Requirements

#### Database Schema (Prisma)
```prisma
model ApiKey {
  id          String   @id @default(uuid())
  userId      String?  // For future multi-user support
  name        String   // User-friendly name ("My Claude Bot", "Desktop MCP", etc.)
  key         String   @unique // The actual API key (hashed)
  keyPrefix   String   // First 8 chars for display (e.g., "sk_prod_12345678...")
  permissions Json     // {"read": true, "write": true, "bets": true, "stats": true}
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revoked     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiKeyUsage {
  id        String   @id @default(uuid())
  apiKeyId  String
  apiKey    ApiKey   @relation(fields: [apiKeyId], references: [id])
  endpoint  String
  method    String
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

#### API Endpoints
- `POST /api/keys` - Create new API key
- `GET /api/keys` - List all API keys (returns keyPrefix only, not full key)
- `DELETE /api/keys/:id` - Revoke API key
- `PUT /api/keys/:id` - Update key name or permissions

#### Authentication Middleware
```typescript
// middleware/api-key-auth.ts
export const apiKeyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer sk_')) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  const key = authHeader.replace('Bearer ', '');
  
  // Hash and lookup key
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      key: hashApiKey(key),
      revoked: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  });
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid or expired API key' });
  }
  
  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });
  
  // Log usage
  await prisma.apiKeyUsage.create({
    data: {
      apiKeyId: apiKey.id,
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }
  });
  
  req.apiKey = apiKey;
  next();
};
```

#### Key Generation
```typescript
// utils/api-key-generator.ts
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export function generateApiKey(): string {
  // Format: sk_prod_32chars or sk_test_32chars
  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'test';
  const random = crypto.randomBytes(24).toString('base64url');
  return `sk_${env}_${random}`;
}

export function hashApiKey(key: string): string {
  return bcrypt.hashSync(key, 10);
}

export function getKeyPrefix(key: string): string {
  // Return first 12 chars for display
  return key.substring(0, 12) + '...';
}
```

### Frontend Requirements

#### Settings Page Enhancement
```typescript
// pages/Settings.tsx (new or enhanced)
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: {
    read: boolean;
    write: boolean;
    bets: boolean;
    stats: boolean;
  };
  lastUsedAt: string | null;
  createdAt: string;
}

function ApiKeySettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  
  // Create key modal shows full key ONCE after creation
  // User must copy it - can't retrieve later
  
  return (
    <div>
      <h2>API Keys</h2>
      <p>Generate API keys to allow Claude and other integrations to access your dashboard.</p>
      
      <button onClick={() => setShowCreateModal(true)}>
        + Create New API Key
      </button>
      
      <table>
        {/* List of existing keys with revoke buttons */}
      </table>
      
      {newKeyValue && (
        <div className="alert-success">
          <strong>Your API Key (save this now!):</strong>
          <code>{newKeyValue}</code>
          <button onClick={() => navigator.clipboard.writeText(newKeyValue)}>
            Copy to Clipboard
          </button>
          <p className="text-red-600">
            This key will only be shown once. Store it securely.
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Cog Wheel Menu
Add "API Keys" option to settings dropdown in header.

---

## Feature 2: AI Bet Creation API & MCP Integration

### Purpose
Allow Claude (via MCP) to create bets programmatically, potentially from images of bet slips, odds screenshots, etc.

### Backend Requirements

#### New API Endpoint
```typescript
// routes/ai-bets.routes.ts
router.post('/api/ai/bets', apiKeyAuth, async (req, res) => {
  const {
    games,           // Array of game identifiers (team names, IDs, etc.)
    selections,      // What to bet on (spread, total, moneyline)
    betType,         // single, parlay, teaser
    stake,
    teaserPoints,
    notes,
    source           // 'image', 'text', 'conversation'
  } = req.body;
  
  // Fuzzy match games by team names
  const matchedGames = await fuzzyMatchGames(games);
  
  // Build bet structure
  const bet = {
    name: generateBetName(selections),
    betType,
    stake,
    legs: selections.map(sel => ({
      gameId: matchedGames[sel.gameIndex].id,
      selectionType: sel.type,
      selection: sel.side,
      odds: sel.odds,
      line: sel.line
    })),
    notes: `Created by AI${source ? ` from ${source}` : ''}\n${notes || ''}`
  };
  
  // Use existing bet service
  const createdBet = await betService.createBet(bet);
  
  return res.json({
    success: true,
    bet: createdBet,
    message: 'Bet created successfully'
  });
});
```

#### Fuzzy Game Matching
```typescript
// utils/game-matcher.ts
export async function fuzzyMatchGames(gameDescriptions: string[]) {
  const today = new Date();
  const games = await prisma.game.findMany({
    where: {
      commenceTime: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
        lte: new Date(today.setHours(23, 59, 59, 999))
      },
      status: { notIn: ['final', 'in_progress'] }
    },
    include: { sport: true }
  });
  
  // Match by team name similarity
  return gameDescriptions.map(desc => {
    const bestMatch = games.find(game => {
      const descLower = desc.toLowerCase();
      return (
        descLower.includes(game.homeTeamName.toLowerCase()) ||
        descLower.includes(game.awayTeamName.toLowerCase())
      );
    });
    
    return bestMatch || null;
  });
}
```

### MCP Integration

#### New MCP Server File
```python
# mcp/dashboard_mcp_server.py (NEW)
from mcp import FastMCP
import aiohttp
import os

mcp = FastMCP("Sports Dashboard")

@mcp.tool()
async def create_bet(
    games: list[str],
    selections: list[dict],
    bet_type: str,
    stake: float,
    notes: str = ""
) -> dict:
    """
    Create a bet on the dashboard
    
    Args:
        games: List of game descriptions (e.g., ["Lakers vs Warriors", "Celtics vs Heat"])
        selections: List of bet selections with type, side, odds, line
        bet_type: Type of bet (single, parlay, teaser)
        stake: Amount to wager
        notes: Optional notes about the bet
    """
    api_key = os.getenv("DASHBOARD_API_KEY")
    api_url = os.getenv("DASHBOARD_API_URL", "http://localhost:3001")
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{api_url}/api/ai/bets",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "games": games,
                "selections": selections,
                "betType": bet_type,
                "stake": stake,
                "notes": notes,
                "source": "mcp"
            }
        ) as response:
            return await response.json()

@mcp.tool()
async def get_active_games(sport: str = None) -> list[dict]:
    """Get list of active games available for betting"""
    api_key = os.getenv("DASHBOARD_API_KEY")
    api_url = os.getenv("DASHBOARD_API_URL", "http://localhost:3001")
    
    params = {}
    if sport:
        params["sport"] = sport
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{api_url}/api/games",
            headers={"Authorization": f"Bearer {api_key}"},
            params=params
        ) as response:
            data = await response.json()
            return data.get("data", {}).get("games", [])

@mcp.tool()
async def get_my_bets(status: str = "all") -> list[dict]:
    """Get user's betting history"""
    api_key = os.getenv("DASHBOARD_API_KEY")
    api_url = os.getenv("DASHBOARD_API_URL", "http://localhost:3001")
    
    params = {}
    if status != "all":
        params["status"] = status
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{api_url}/api/bets",
            headers={"Authorization": f"Bearer {api_key}"},
            params=params
        ) as response:
            data = await response.json()
            return data.get("bets", [])
```

#### Claude Desktop Config
```json
{
  "mcpServers": {
    "sports-dashboard": {
      "command": "python",
      "args": ["c:/path/to/dashboard_mcp_server.py"],
      "env": {
        "DASHBOARD_API_KEY": "sk_prod_your_key_here",
        "DASHBOARD_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Image-to-Bet Flow (Future Enhancement)
1. User uploads bet slip image to Claude
2. Claude uses vision to extract bet details
3. Claude calls `create_bet` MCP tool with extracted data
4. Dashboard creates the bet and returns confirmation

---

## Feature 3: Player Props Betting

### Research Phase

#### API Support
- **The Odds API**: Check which player prop markets are available
  - Already supports 70+ player props (points, rebounds, assists, etc.)
  - Need to verify which bookmakers provide player props
  - Cost per request (player props are separate from game odds)

#### Database Schema Changes
```prisma
model PlayerProp {
  id          String   @id @default(uuid())
  externalId  String   @unique
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id])
  playerId    String?  // Future: link to Player table
  playerName  String
  propType    String   // "player_points", "player_rebounds", etc.
  line        Decimal
  overOdds    Int
  underOdds   Int
  bookmaker   String
  lastUpdate  DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Player {
  id        String   @id @default(uuid())
  externalId String  @unique
  name      String
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  position  String?
  number    String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### UI Design Mockups

#### Player Props Tab
```
┌─────────────────────────────────────────────────────┐
│ Games > Player Props                                │
├─────────────────────────────────────────────────────┤
│ [NBA ▼] [Today ▼] [All Players ▼] [All Props ▼]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Lakers vs Warriors - 7:00 PM                        │
│ ┌───────────────────────────────────────────────┐  │
│ │ LeBron James (LAL)                            │  │
│ │ ┌─────────────┬─────────┬─────────┐          │  │
│ │ │ Points      │ O 26.5  │ U 26.5  │          │  │
│ │ │             │ -110    │ -110    │          │  │
│ │ ├─────────────┼─────────┼─────────┤          │  │
│ │ │ Rebounds    │ O 7.5   │ U 7.5   │          │  │
│ │ │             │ -115    │ -105    │          │  │
│ │ ├─────────────┼─────────┼─────────┤          │  │
│ │ │ Assists     │ O 6.5   │ U 6.5   │          │  │
│ │ │             │ +100    │ -120    │          │  │
│ │ └─────────────┴─────────┴─────────┘          │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ Stephen Curry (GSW)                           │  │
│ │ ┌─────────────┬─────────┬─────────┐          │  │
│ │ │ Points      │ O 28.5  │ U 28.5  │          │  │
│ │ │             │ -105    │ -115    │          │  │
│ │ ├─────────────┼─────────┼─────────┤          │  │
│ │ │ 3-Pointers  │ O 4.5   │ U 4.5   │          │  │
│ │ │             │ +110    │ -130    │          │  │
│ │ └─────────────┴─────────┴─────────┘          │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Player Props in Bet Slip
- Same bet slip component, just different leg type
- Display player name + prop type + line
- Example: "LeBron James - Points Over 26.5 (-110)"

### Implementation Phases

**Phase 1: Data Integration (Week 1-2)**
- Add PlayerProp and Player tables to database
- Create API endpoints to fetch player props from The Odds API
- Build sync service (similar to odds-sync for game odds)
- Add player prop data to games endpoint

**Phase 2: Backend API (Week 2-3)**
- Update bet creation to support player prop legs
- Validate player prop bets against current lines
- Extend outcome resolver to settle player prop bets
- Create player stats lookup service (may need ESPN/NBA API)

**Phase 3: Frontend UI (Week 3-4)**
- Create PlayerPropsTab component
- Add player search/filter functionality
- Design player prop cards
- Integrate with existing bet slip
- Add player prop specific bet history views

**Phase 4: MCP Integration (Week 4-5)**
- Add `get_player_props` MCP tool
- Add `create_player_prop_bet` MCP tool
- Update AI bet creation endpoint to handle player props
- Test Claude's ability to create player prop parlays

---

## Implementation Priority

### Immediate (This Week)
1. ✅ API Key Management backend (database + endpoints)
2. ✅ API Key Management frontend (settings page)
3. ✅ API Key authentication middleware

### Short-term (Next 2 Weeks)
4. ✅ AI bet creation endpoint with fuzzy matching
5. ✅ MCP server for dashboard integration
6. ⏳ Test Claude → MCP → Dashboard flow

### Medium-term (Next Month)
7. ✅ Player props database schema
8. ✅ Player props data sync service
9. ✅ Player props UI (tab + cards)
10. ✅ Player prop betting integration

### Long-term (Future)
11. Image-to-bet OCR/vision integration
12. Advanced analytics for player props
13. Player prop alerts/notifications
14. Social features (share bets, leaderboards)

---

## Technical Considerations

### Security
- API keys stored hashed (bcrypt)
- Keys shown in full ONCE after creation
- Rate limiting per API key
- Permission scoping (read-only vs full access)
- IP whitelisting option
- Key expiration support

### Performance
- Cache player prop data (5-15 min TTL)
- Batch player prop requests
- Lazy load player props per game
- Index on playerName for fast searches

### Cost Management
- The Odds API charges per request
- Player props are MORE EXPENSIVE than game odds
- Implement smart caching strategy
- Only fetch player props for games user is viewing
- Consider limiting number of player props per game

### User Experience
- Clear visual distinction between game odds and player props
- Easy way to combine game + player props in parlays
- Player name autocomplete search
- Show player stats alongside props (points per game, etc.)
- Real-time prop line movement

---

## Next Steps

1. Review this roadmap and prioritize features
2. Start with API key management (foundational for everything else)
3. Build out AI bet creation (enables MCP integration)
4. Research player props cost/feasibility before committing
5. Create detailed UI mockups for player props

## Questions to Resolve

1. **Multi-user support**: Single API key per installation or per user?
2. **Player props budget**: What's acceptable API cost per month?
3. **Image processing**: Should we build OCR or rely on Claude's vision?
4. **Player data**: Do we need full player database or just names?
5. **Live props**: Do we support live player props or only pre-game?

