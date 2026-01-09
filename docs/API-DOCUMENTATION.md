# Sports-Odds-MCP - Complete API Documentation

Comprehensive API reference for MCP tools, Backend HTTP endpoints, and Frontend architecture.

---

## Table of Contents

1. [MCP API (Claude Desktop Integration)](#mcp-api-claude-desktop-integration)
2. [Backend REST API (Dashboard)](#backend-rest-api-dashboard)
3. [Frontend Architecture](#frontend-architecture)

---

## MCP API (Claude Desktop Integration)

The MCP server exposes 30+ tools to Claude Desktop via stdio transport. All responses follow the pattern:
```json
{
  "success": true,
  "data": { ... },
  "error": "error message" // only on failure
}
```

### The Odds API Tools

#### `get_available_sports(all_sports: bool = False)`
List all available sports from The Odds API.

**Parameters:**
- `all_sports` (bool): If False (default), returns only in-season sports

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "americanfootball_nfl",
      "title": "NFL",
      "group": "American Football",
      "active": true,
      "has_outrights": false
    }
  ]
}
```

#### `get_odds(sport, regions="us", markets=None, odds_format="american", date_format="iso")`
Get current betting odds for upcoming games.

**Parameters:**
- `sport` (str): Sport key (e.g., `americanfootball_nfl`, `basketball_nba`)
- `regions` (str): Comma-separated bookmaker regions (us, us2, uk, au, eu)
- `markets` (str): Comma-separated markets (h2h, spreads, totals, player_points, etc.)
- `odds_format` (str): american, decimal, or fractional
- `date_format` (str): iso or unix

**Markets:**
- **Game Markets**: `h2h` (moneyline), `spreads`, `totals`, `outrights`
- **Player Props**: 70+ markets including `player_points`, `player_rebounds`, `player_assists`, `player_pass_tds`, `player_rush_yds`, `player_home_runs`, `player_shots_on_goal`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "event_id",
      "sport_key": "basketball_nba",
      "commence_time": "2026-01-09T19:00:00Z",
      "home_team": "Los Angeles Lakers",
      "away_team": "Boston Celtics",
      "bookmakers": [
        {
          "key": "draftkings",
          "title": "DraftKings",
          "markets": [
            {
              "key": "h2h",
              "outcomes": [
                {"name": "Los Angeles Lakers", "price": -150},
                {"name": "Boston Celtics", "price": +130}
              ]
            }
          ]
        }
      ]
    }
  ],
  "usage": {
    "remaining": "492",
    "used": "8"
  }
}
```

#### `get_scores(sport, days_from=3)`
Get live and recent scores.

**Parameters:**
- `sport` (str): Sport key
- `days_from` (int): Number of days back to retrieve scores

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "event_id",
      "sport_key": "basketball_nba",
      "commence_time": "2026-01-08T19:00:00Z",
      "completed": true,
      "home_team": "Los Angeles Lakers",
      "away_team": "Boston Celtics",
      "scores": [
        {"name": "Los Angeles Lakers", "score": "112"},
        {"name": "Boston Celtics", "score": "108"}
      ]
    }
  ]
}
```

#### `get_event_odds(sport, event_id, markets=None, regions="us")`
Get detailed odds for a specific event.

#### `search_odds(query, sport=None, markets="h2h")`
Natural language search for odds by team name or matchup.

**Parameters:**
- `query` (str): Team name or matchup (e.g., "Lakers", "Lakers vs Celtics")
- `sport` (str): Optional sport key to narrow search
- `markets` (str): Comma-separated markets to include

### ESPN API Tools

#### `get_espn_scoreboard(sport, league, date=None, limit=10)`
Get raw ESPN scoreboard data (JSON).

**Parameters:**
- `sport` (str): Sport type (football, basketball, baseball, hockey, soccer)
- `league` (str): League code (nfl, nba, mlb, nhl, etc.)
- `date` (str): Optional date in YYYYMMDD format
- `limit` (int): Max games (default 10, max 25)

**Response:**
```json
{
  "success": true,
  "data": {
    "leagues": [...],
    "events": [
      {
        "id": "401547516",
        "name": "Los Angeles Lakers at Boston Celtics",
        "shortName": "LAL @ BOS",
        "competitions": [...]
      }
    ]
  }
}
```

#### `get_formatted_scoreboard(sport, league, date=None, limit=10)`
Get formatted Markdown scoreboard table.

**Returns:** Markdown table with:
- Team names, scores
- Game status (🔴 LIVE, ✅ FINAL, 🕐 Scheduled)
- Time/broadcast info

#### `get_visual_scoreboard(sport, league, date=None, limit=10)`
Get interactive React artifact scoreboard.

**Returns:** Structured data for Claude to render as interactive cards with team colors, logos, expandable odds.

#### `get_matchup_cards(sport, league, limit=10)`
Get ASCII art matchup cards.

**Returns:** Text with box-drawing characters:
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                            MATCHUP                             │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│          Los Angeles Lakers  vs  Boston Celtics                │
│                                                                │
│                           112  -  108                          │
│                                                                │
│                  Tue, Jan 08 @ 07:00 PM                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### `get_espn_standings(sport, league, season=None)`
Get league standings.

#### `get_espn_teams(sport, league)`
List all teams in a league.

#### `get_espn_team_details(sport, league, team_id)`
Get detailed team information.

#### `get_espn_team_schedule(sport, league, team_id, season=None)`
Get team schedule and results.

#### `get_espn_news(sport, league, limit=10)`
Get latest news articles.

#### `search_espn(query, sport=None)`
Search for teams/players/content.

### Combined Tools

#### `get_comprehensive_game_info(sport, league, event_id)`
Combines ESPN game data with betting odds.

#### `get_odds_comparison(sport, event_id=None, query=None)`
Compare odds across bookmakers in Markdown table.

### Utility Tools

#### `get_team_reference_table(sport)`
Get quick reference table of team IDs, abbreviations, and divisions.

**Parameters:**
- `sport` (str): nfl, nba, or nhl

**Returns:** Markdown table with all teams.

#### `find_team_id_by_name(team_name, sport)`
Fuzzy match team name to ESPN ID.

---

## Backend REST API (Dashboard)

Express + TypeScript REST API for the web dashboard. Base URL: `http://localhost:3001/api`

### Authentication

All `/api/mcp/*` routes require authentication via Bearer token:
```http
Authorization: Bearer <token>
```

### Response Format

All endpoints return:
```json
{
  "status": "success" | "error",
  "data": { ... },  // on success
  "message": "...", // on error
  "error": "..."    // detailed error message
}
```

### Bets API (`/api/bets`)

#### `GET /api/bets`
List bets with filters.

**Query Parameters:**
- `status` (string): Filter by status (pending, won, lost, push, cancelled)
- `betType` (string): Filter by type (single, parlay, teaser)
- `sportKey` (string): Filter by sport
- `startDate` (ISO string): Filter by date range start
- `endDate` (ISO string): Filter by date range end
- `limit` (number): Max results (default: 50)
- `offset` (number): Pagination offset

**Response:**
```json
{
  "status": "success",
  "data": {
    "bets": [
      {
        "id": "uuid",
        "name": "Lakers ML",
        "betType": "single",
        "stake": 100.00,
        "status": "pending",
        "oddsAtPlacement": -150,
        "potentialPayout": 166.67,
        "createdAt": "2026-01-08T10:00:00Z",
        "legs": [
          {
            "id": "uuid",
            "gameId": "uuid",
            "selectionType": "moneyline",
            "selection": "home",
            "teamName": "Los Angeles Lakers",
            "odds": -150,
            "status": "pending",
            "game": {
              "awayTeamName": "Boston Celtics",
              "homeTeamName": "Los Angeles Lakers",
              "commenceTime": "2026-01-09T19:00:00Z"
            }
          }
        ]
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

#### `POST /api/bets`
Create a new bet.

**Request Body:**
```json
{
  "name": "Lakers ML + Celtics Spread",
  "betType": "parlay",
  "stake": 50.00,
  "legs": [
    {
      "gameId": "uuid",
      "selectionType": "moneyline",
      "selection": "home",
      "teamName": "Los Angeles Lakers",
      "odds": -150
    },
    {
      "gameId": "uuid",
      "selectionType": "spread",
      "selection": "away",
      "teamName": "Boston Celtics",
      "line": -5.5,
      "odds": -110
    }
  ],
  "notes": "Feeling confident about both teams"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "Lakers ML + Celtics Spread",
    "betType": "parlay",
    "stake": 50.00,
    "status": "pending",
    "oddsAtPlacement": 179.55,
    "potentialPayout": 139.77,
    "legs": [...]
  }
}
```

#### `GET /api/bets/:id`
Get single bet with full details.

#### `PATCH /api/bets/:id`
Update bet (name, stake, notes).

**Request Body:**
```json
{
  "name": "Updated Name",
  "stake": 75.00,
  "notes": "Updated notes"
}
```

#### `DELETE /api/bets/:id`
Delete a bet.

#### `POST /api/bets/:id/settle`
Manually settle a bet.

**Request Body:**
```json
{
  "status": "won",
  "actualPayout": 166.67
}
```

#### `GET /api/bets/stats`
Get betting statistics.

**Query Parameters:**
- `sportKey` (string): Filter by sport
- `betType` (string): Filter by bet type
- `startDate` (ISO string): Date range start
- `endDate` (ISO string): Date range end

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalBets": 142,
    "totalStake": 7150.00,
    "totalPayout": 8234.50,
    "netProfit": 1084.50,
    "roi": 15.17,
    "winRate": 54.23,
    "avgOdds": -114.5,
    "byStatus": {
      "pending": 12,
      "won": 77,
      "lost": 48,
      "push": 5
    },
    "byType": {
      "single": 89,
      "parlay": 53
    },
    "bySport": {
      "basketball_nba": { "bets": 45, "netProfit": 523.50 },
      "americanfootball_nfl": { "bets": 62, "netProfit": 561.00 }
    }
  }
}
```

### Games API (`/api/games`)

#### `GET /api/games`
List games with filters (timezone-aware).

**Query Parameters:**
- `date` (YYYY-MM-DD): Filter by specific date in user's local timezone
- `sport` (string): Sport key (e.g., `basketball_nba`, `americanfootball_nfl`, or `all`)
- `status` (string): Game status (scheduled, in_progress, completed)
- `timezoneOffset` (number): User's timezone offset in minutes (e.g., 420 for MST/UTC-7)

**Timezone Handling:**
The API accepts the user's timezone offset to correctly filter games by date. For example:
- User in MST (UTC-7) requests `date=2026-01-09&timezoneOffset=420`
- API converts to UTC range: `2026-01-09 07:00:00Z` to `2026-01-10 06:59:59Z`
- Returns all games occurring during Jan 9 in MST

**Response:**
```json
{
  "status": "success",
  "data": {
    "games": [
      {
        "id": "uuid",
        "exterKey": "basketball_nba",
        "sportName": "NBA Basketball",
        "sport": {
          "id": "uuid",
          "key": "basketball_nba",
          "name": "NBA Basketball",
          "groupName": "Basketball",
          "isActive": trueltics",
        "homeTeamName": "Los Angeles Lakers",
        "commenceTime": "2026-01-09T19:00:00Z",
        "status": "scheduled",
        "completed": false,
        "sport": {
          "key": "basketball_nba",
          "name": "NBA Basketball"
        },
        "currentOdds": [
          {
            "id": "uuid",
            "bookmaker": "draftkings",
            "marketType": "h2h",
            "selection": "home",
            "price": -150,
            "lastUpdated": "2026-01-08T15:30:00Z"
          }
        ]
      }
    ],
    "count": 15
  }
}
**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "externalId": "odds_api_event_id",
    "sportId": "uuid",
    "awayTeamName": "Boston Celtics",
    "homeTeamName": "Los Angeles Lakers",
    "commenceTime": "2026-01-09T19:00:00Z",
    "statgameId": "uuid",
        "bookmaker": "draftkings",
        "marketType": "spread",
        "selection": "home",
        "price": -110,
        "point": -5.5
      }
    ],
    "count": 245
  }
}
```

### Admin API (`/api/admin`)

Administrative endpoints for system management and data initialization.

#### `POST /api/admin/init-sports`
Initialize sports data in database.

**Response:**
```json
{
  "status": "success",
  "message": "Initialized 7 sports",
  "data": [
    {
      "id": "uuid",
      "key": "americanfootball_nfl",
      "name": "NFL",
      "groupName": "American Football",
      "isActive": true
    }
  ]
}
```

**Sports Initialized:**
- NFL (americanfootball_nfl)
- NBA (basketball_nba)
- NCAAB (basketball_ncaab)
- NHL (icehockey_nhl)
- MLB (baseball_mlb)
- EPL (soccer_epl) - inactive by default
- UEFA Champions League (soccer_uefa_champs_league) - inactive by default

#### `POST /api/admin/sync-odds`
Manually trigger odds synchronization from The Odds API.

**Request Body:**
```json
{
  "sportKey": "basketball_nba"  // optional, omit to sync all active sports
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Odds sync started in background",
  "data": {
    "sportKey": "basketball_nba"
  }
}
```

**Note:** Sync runs asynchronously. Check logs for progress and completion.

#### `POST /api/admin/resolve-outcomes`
Manually trigger bet outcome resolution.

Checks completed games and automatically settles bets based on results.

**Response:**
```json
{
  "status": "success",
  "message": "Outcome resolution started in background"
}
```

#### `GET /api/admin/stats`
Get database statistics and overview.

**Response:**
```json
{
  "status": "success",
  "data": {
    "database": {
      "sports": 7,
      "teams": 124,
      "games": 458,
      "currentOdds": 6847,
      "oddsSnapshots": 45283,
      "bets": 142,
      "betLegs": 267
    },
    "activeSports": [
      { "key": "americanfootball_nfl", "name": "NFL" },
      { "key": "basketball_nba", "name": "NBA" }
    ],
    "recentGames": 127
  }
}
```

#### `GET /api/admin/health`
Detailed health check with database connectivity test.

**Response:**
```json
{
  "status": "success",
  "data": {
    "database": "connected",
    "dataInitialized": true,
    "hasGames": true,
    "timestamp": "2026-01-09T15:30:00Z"
}
```

#### `GET /api/games/:id/odds`
Get current odds for a specific game.

**Query Parameters:**
- `bookmaker` (string): Filter by bookmaker key (e.g., `draftkings`)
- `marketType` (string): Filter by market type (`h2h`, `spreads`, `totals`)

**Response:**
```json
{

#### `GET /api/games/:id/odds/history`
Get historical odds snapshots for line movement tracking.

**Query Parameters:**
- `bookmaker` (string): Filter by bookmaker key
- `marketType` (string): Filter by market type
- `hours` (number): Number of hours back to retrieve (default: 24)
#### `GET /api/games/:id`
Get single game with all odds.

#### `GET /api/games/:id/odds-history`
Get historical odds snapshots for line movement tracking.

**Response:**
```json
{
  "status": "success",
  "data": {
    "snapshots": [
      {
        "timestamp": "2026-01-08T10:00:00Z",
        "bookmaker": "draftkings",
        "marketType": "spread",
        "selection": "home",
        "price": -110,
        "point": -5.5
      }
    ]
  }
}
```

### MCP Integration API (`/api/mcp`)

**Authentication Required** - All routes require Bearer token.

#### `GET /api/mcp/bets/active`
Get all pending bets for MCP integration.

**Response:**
```json
{
  "status": "success",
  "data": {
    "activeBets": [
      {
        "id": "uuid",
        "name": "Lakers ML",
        "betType": "single",
        "stake": 100.00,
        "potentialPayout": 166.67,
        "legs": [...]
      }
    ],
    "count": 12,
    "totalExposure": 1200.00
  }
}
```

#### `GET /api/mcp/bets/summary`
Get quick betting summary for MCP context.

**Response:**
```json
{
  "status": "success",
  "data": {
    "pending": {
      "count": 12,
      "totalStake": 1200.00,
      "potentialWin": 1650.00
    },
    "recentResults": {
      "last7Days": {
        "won": 8,
        "lost": 5,
        "netProfit": 345.50
      }
    },
    "favorites": {
      "bestSport": "basketball_nba",
      "bestBetType": "single"
    }
  }
}
```

#### `GET /api/mcp/bets/advice-context`
Get full context for AI betting advice.

**Response:** Extended summary with:
- All active bets
- Recent performance by sport
- Betting patterns and tendencies
- Risk exposure by game/sport

#### `GET /api/mcp/games/with-exposure`
Get games with user's betting positions.

**Query Parameters:**
- `sport` (string): Filter by sport
- `onlyWithBets` (boolean): Show only games with active bets

**Response:**
```json
{
  "status": "success",
  "data": {
    "games": [
      {
        "game": {
          "id": "uuid",
          "awayTeamName": "Boston Celtics",
          "homeTeamName": "Los Angeles Lakers",
          "commenceTime": "2026-01-09T19:00:00Z"
        },
        "userBets": [
          {
            "betId": "uuid",
            "name": "Lakers ML",
            "stake": 100.00,
            "selection": "home",
            "selectionType": "moneyline"
          }
        ],
        "totalExposure": 100.00,
        "potentialWin": 166.67
      }
    ]
  }
}
```

#### `POST /api/mcp/bets/quick-create`
Simplified bet creation for MCP.

**Request Body:**
```json
{
  "game_id": "uuid",
  "selection_type": "moneyline",
  "selection": "home",
  "stake": 50.00,
  "odds": -150,
  "name": "Lakers ML"
}
```

### Admin API (`/api/admin`)

#### `GET /api/admin/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-08T15:30:00Z",
  "database": "connected",
  "uptime": 3600
}
```

---

## Frontend Architecture

React + TypeScript + Vite + Redux Toolkit + Tailwind CSS

### Directory Structure

```
src/
├── components/          # Reusable UI components
│   ├── bets/           # Bet-related components
│   ├── odds/           # Odds display components
│   ├── stats/          # Statistics components
│   └── common/         # Shared components
├── pages/              # Route pages
├── store/              # Redux store
├── services/           # API clients
├── hooks/              # Custom React hooks
├── types/              # TypeScript types
└── utils/              # Utility functions
```

### State Management (Redux Toolkit)

#### Store Configuration (`store/index.ts`)
```typescript
import { configureStore } from '@reduxjs/toolkit';
import betSlipReducer from './betSlipSlice';

export const store = configureStore({
  reducer: {
    betSlip: betSlipReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### Bet Slip Slice (`store/betSlipSlice.ts`)

**State:**
```typescript
interface BetSlipState {
  legs: BetLeg[];
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;
  teaserPoints: number;
}
```

**Actions:**
- `addLeg(leg)` - Add/update bet leg (auto-dedupes by gameId + selectionType)
- `removeLeg(index)` - Remove bet leg
- `updateLeg(index, updates)` - Update specific leg
- `setBetType(type)` - Set bet type
- `setStake(amount)` - Set stake amount
- `setTeaserPoints(points)` - Set teaser points (6, 6.5, 7)
- `clearBetSlip()` - Clear all legs
- `updateOdds(gameId, odds)` - Update odds for specific game

**Auto-behaviors:**
- Adding 2+ legs auto-switches to parlay
- Removing to 1 leg auto-switches to single
- Clearing legs resets stake to 0

### API Service (`services/api.ts`)

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

// Auto-adds Bearer token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-handles 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

### Key Components

#### `components/bets/BetSlip.tsx`
Interactive bet slip widget.

**Features:**
- Add/remove legs dynamically
- Adjust stake with validation
- Calculate potential payout (parlay calculations)
- Teaser control for NFL/NBA spreads/totals
- Submit bet to API

**Props:** None (uses Redux state)

#### `components/bets/BetCard.tsx`
Display single bet with all details.

**Props:**
```typescript
interface BetCardProps {
  bet: Bet;
  onSettle?: (betId: string, status: 'won' | 'lost' | 'push') => void;
  onDelete?: (betId: string) => void;
  onEdit?: (betId: string) => void;
}
```

#### `components/odds/GameCard.tsx`
Display game with odds from multiple bookmakers.

**Props:**
```typescript
interface GameCardProps {
  game: Game;
  onAddToBetSlip: (leg: BetLeg) => void;
  showOdds?: boolean;
  collapsed?: boolean;
}
```

**Features:**
- Expandable odds table
- Click odds to add to bet slip
- Line movement indicators
- Team logos and colors

#### `components/odds/OddsGrid.tsx`
Grid of games with odds comparison.

**Props:**
```typescript
interface OddsGridProps {
  sport?: string;
  date?: Date;
  bookmakers?: string[];
}
```

**Features:**
- Filter by sport, date
- Sort by commence time
- Toggle between moneyline/spread/total views
- Refresh odds button

#### `components/stats/StatsDashboard.tsx`
Statistics and performance charts.

**Features:**
- Win rate charts (by sport, by bet type)
- P&L timeline graph
- ROI by bookmaker
- Bet distribution pie charts
- Filters: date range, sport, bet type

### Custom Hooks

#### `hooks/useBetSlip.ts`
```typescript
export const useBetSlip = () => {
  const dispatch = useDispatch();
  const betSlip = useSelector((state: RootState) => state.betSlip);

  const addLeg = (leg: BetLeg) => dispatch(addLegAction(leg));
  const removeLeg = (index: number) => dispatch(removeLegAction(index));
  const calculatePayout = () => { /* Calculate based on betType */ };

  return { betSlip, addLeg, removeLeg, calculatePayout };
};
```

#### `hooks/useOddsPolling.ts`
```typescript
export const useOddsPolling = (gameId: string, interval: number = 30000) => {
  const [odds, setOdds] = useState<Odds[]>([]);
  
  useEffect(() => {
    const fetchOdds = async () => {
      const response = await apiClient.get(`/games/${gameId}`);
      setOdds(response.data.data.currentOdds);
    };
    
    fetchOdds();
    const timer = setInterval(fetchOdds, interval);
    
    return () => clearInterval(timer);
  }, [gameId, interval]);
  
  return odds;
};
```

### Pages

#### `pages/BetHistory.tsx`
List of all bets with filters and search.

**Features:**
- Tabs: Active, Won, Lost, All
- Search by name
- Filter by sport, date range
- Sort by date, stake, potential win
- Pagination

#### `pages/Stats.tsx`
Performance analytics and insights.

**Features:**
- Overview cards (total bets, win rate, ROI, net profit)
- Charts: P&L over time, win rate by sport, bet distribution
- Best/worst performing sports/bet types
- Recent activity feed

### TypeScript Types

```typescript
// types/game.types.ts
export interface Game {
  id: string;
  externalId: string;
  sportId: string;
  awayTeamName: string;
  homeTeamName: string;
  commenceTime: Date;
  status: 'scheduled' | 'in_progress' | 'completed';
  completed: boolean;
  sport: Sport;
  currentOdds: Odds[];
}

export interface Sport {
  id: string;
  key: string;
  name: string;
  active: boolean;
}

export interface Odds {
  id: string;
  gameId: string;
  bookmaker: string;
  marketType: 'h2h' | 'spreads' | 'totals';
  selection: 'home' | 'away' | 'over' | 'under';
  price: number;
  point?: number;
  lastUpdated: Date;
}

// types/bet.types.ts
export interface Bet {
  id: string;
  name: string;
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled';
  oddsAtPlacement: number;
  potentialPayout: number;
  actualPayout?: number;
  teaserPoints?: number;
  notes?: string;
  createdAt: Date;
  settledAt?: Date;
  legs: BetLeg[];
}

export interface BetLeg {
  id: string;
  betId: string;
  gameId: string;
  selectionType: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  teamName?: string;
  line?: number;
  odds: number;
  userAdjustedLine?: number;
  userAdjustedOdds?: number;
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled';
  result?: number;
  game: Game;
}
```

### Environment Configuration

```env
# .env
VITE_API_URL=http://localhost:3001/api
VITE_ENABLE_MOCK_API=false
VITE_ODDS_REFRESH_INTERVAL=30000
```

---

## Quick Reference

### MCP Server
```bash
cd mcp
python sports_mcp_server.py
```

### Backend
```bash
cd dashboard/backend
npm run dev  # http://localhost:3001
```

### Frontend
```bash
cd dashboard/frontend
npm run dev  # http://localhost:5173
```

### Testing
```bash
# Backend
cd dashboard/backend
npm test

# MCP (when implemented)
cd mcp
pytest tests/ -v
```
