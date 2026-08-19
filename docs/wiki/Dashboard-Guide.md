<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/assets/logo-dashboard.png" alt="BetTrack Dashboard" width="200"/>
</div>

# Dashboard Guide

Complete guide to the BetTrack web dashboard - full-stack React application for bet tracking and odds visualization.

## Table of Contents

- [Screenshots](#screenshots)
- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Frontend](#frontend)
- [Backend](#backend)
- [Database](#database)
- [Features](#features)
- [Development](#development)
- [Deployment](#deployment)
- [API Reference](#api-reference)

---

## Screenshots

### Dashboard V2 Interface

<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/docs/assets/dashboard-dark.png" alt="Dashboard Dark Mode" width="700"/>
  <p><em>Dark mode with live odds, game cards, filters, and bet slip</em></p>
  <br>
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/docs/assets/dashboard-light.png" alt="Dashboard Light Mode" width="700"/>
  <p><em>Light mode with clean interface and responsive layout</em></p>
</div>

### Key Features Shown:
- **Left Sidebar**: Sport filters, status filters, date picker, bookmaker selection
- **Main Content**: Game cards with live scores, odds comparison, and betting markets
- **Bet Slip**: Floating right panel for bet management (visible on larger screens)
- **Responsive Design**: Mobile-friendly with hamburger menu for filters
- **Dark/Light Mode**: Full theme support with purple accent colors

---

## Overview

The BetTrack Dashboard is a full-featured web application for tracking sports bets, visualizing odds movements, and analyzing betting performance. Built as a modern, full-stack TypeScript application with React, Node.js, and PostgreSQL.

### 🎯 Purpose

- **Bet Management**: Create, track, and settle bets across multiple sports
- **Odds Visualization**: Line movement charts with Recharts
- **Performance Analytics**: Win rates, ROI, profit/loss, Closing Line Value (CLV)
- **Background Jobs**: Automated odds syncing, team sync, NFL/NCAAF hourly window, and bet settlement
- **Multi-Sport Support**: NFL, NBA, NHL, MLB, NCAAB, Soccer leagues
- **Advanced Analytics**: Sharp money indicators, bookmaker performance rankings, arbitrage/middle detection, parlay correlation analysis

### 🏗️ Technology Stack

**Frontend**:
- React 18 with TypeScript
- Redux Toolkit for state management
- Vite for fast builds and HMR
- Tailwind CSS for styling
- Recharts for data visualization
- Vitest for testing

**Backend**:
- Node.js 22+ with TypeScript
- Express.js for HTTP routing
- Prisma ORM for database access
- PostgreSQL 15+ database
- node-cron for scheduled jobs
- Jest for testing

**DevOps**:
- Docker multi-stage builds
- GitHub Actions CI/CD
- Nginx for production serving

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Web Browser                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │        React Frontend (Port 5173/80)            │   │
│  │  - Redux Store (Bet Slip)                       │   │
│  │  - React Router                                 │   │
│  │  - Recharts Visualizations                      │   │
│  └──────────────────┬──────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────┘
                      │ HTTP/REST
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Node.js Backend (Port 3001)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Express API Routes                             │   │
│  │  - /api/games, /api/bets, /api/admin            │   │
│  │  - /api/mcp/*, /api/mcp/analytics/*             │   │
│  │  - /api/analytics/clv                           │   │
│  │  - /api/analytics/sharp                         │   │
│  │  - /api/analytics/movements                     │   │
│  │  - /api/analytics/disagreement                  │   │
│  │  - /api/analytics/bookmakers                    │   │
│  │  - /api/analytics/arbitrage                     │   │
│  │  - /api/analytics/correlation                   │   │
│  └──────────────────┬──────────────────────────────┘   │
│  ┌──────────────────┴──────────────────────────────┐   │
│  │  Service Layer                                  │   │
│  │  - OddsSyncService, BetService, GameService     │   │
│  │  - OutcomeService (background)                  │   │
│  │  - LineMovementService, ArbitrageService        │   │
│  │  - BookmakerAnalyticsService, CorrelationSvc    │   │
│  │  - CLVService, SharpIndicatorService            │   │
│  │  - MarketConsensusService, StatsSyncService     │   │
│  └──────────────────┬──────────────────────────────┘   │
│  ┌──────────────────┴──────────────────────────────┐   │
│  │  Scheduled Jobs (node-cron)                     │   │
│  │  - Odds sync: ~10 minutes                       │   │
│  │  - Outcome resolution: Hourly                   │   │
│  │  - Arbitrage scan: after each odds sync         │   │
│  │  - Bookmaker analytics: Daily 02:00 UTC         │   │
│  │  - Football window sync: Hourly                 │   │
│  │  - MLB hourly window sync                       │   │
│  └──────────────────┬──────────────────────────────┘   │
└────────────────────┼────────────────────────────────────┘
                     │ Prisma ORM
                     ▼
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL Database                             │
│  - Sports, Teams, Games                                 │
│  - Bets, OddSnapshots, CurrentOdds                      │
│  - MarketConsensus, SharpMoneyIndicator                 │
│  - BookmakerAnalytics, ArbitrageOpportunity             │
│  - BetLegCorrelation, ParlayAnalysis                    │
│  - Indexes for performance                              │
└─────────────────────────────────────────────────────────┘

External APIs:
- The Odds API (betting odds)
- ESPN API (games, scores, teams)
- API-Sports (live stats: NBA, NFL, NCAAF, NHL, MLB)
```

### Key Design Patterns

1. **Service Layer Pattern**: Business logic separated from routes
2. **Repository Pattern**: Prisma handles all database access
3. **Background Jobs**: Long-running tasks execute asynchronously
4. **State Management**: Redux for client-side state
5. **RESTful API**: Standard HTTP methods and status codes

---

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- The Odds API key

### Installation

```bash
# Clone repository
git clone https://github.com/WFord26/BetTrack.git
cd BetTrack/dashboard

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and ODDS_API_KEY

# Run migrations
npm run prisma:migrate
npm run prisma:generate

# Frontend setup
cd ../frontend
npm install
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Start services (two terminals)
# Terminal 1: Backend
cd dashboard/backend
npm run dev

# Terminal 2: Frontend
cd dashboard/frontend
npm run dev
```

### Initialize Data

```bash
# Initialize sports
curl -X POST http://localhost:3001/api/admin/init-sports

# Sync initial odds
curl -X POST http://localhost:3001/api/admin/sync-odds
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Frontend

### Component Architecture

```
src/
├── components/           # Reusable UI components
│   ├── BetSlip.tsx       # Floating bet slip widget
│   ├── GameCard.tsx      # Individual game display
│   ├── OddsTable.tsx     # Odds comparison table
│   └── LineChart.tsx     # Line movement visualization
├── pages/                # Page-level components
│   ├── HomePage.tsx      # Main dashboard
│   ├── GamesPage.tsx     # Game browser
│   └── BetsPage.tsx      # Bet history
├── store/                # Redux state
│   ├── store.ts          # Store configuration
│   └── betSlipSlice.ts   # Bet slip state
├── hooks/                # Custom hooks
│   ├── useGames.ts       # Fetch games
│   └── useOdds.ts        # Fetch odds
└── utils/                # Utilities
    ├── api.ts            # Axios instance
    └── formatters.ts     # Display formatting
```

### Key Components

#### BetSlip Component

Floating widget for managing bets before submission.

**Features**:
- Add/remove bets
- Stake input
- Payout calculation
- Submit to backend

**State**: Redux Toolkit slice
```typescript
interface BetSlipState {
  bets: Bet[];
  isOpen: boolean;
  totalStake: number;
  potentialPayout: number;
}
```

#### GameCard Component

Displays individual game with odds and betting options.

**Features**:
- Team names and logos
- Game time and status
- Bookmaker odds
- Quick bet buttons
- Expandable for more odds

#### LineChart Component

Visualizes odds movement over time using Recharts.

**Features**:
- Multiple bookmakers
- Time-series data
- Zoom and pan
- Tooltip with details

### State Management

**Redux Toolkit** manages client-side state:

```typescript
// store/betSlipSlice.ts
const betSlipSlice = createSlice({
  name: 'betSlip',
  initialState: { bets: [], isOpen: false },
  reducers: {
    addBet: (state, action) => {
      state.bets.push(action.payload);
    },
    removeBet: (state, action) => {
      state.bets = state.bets.filter(b => b.id !== action.payload);
    },
    updateStake: (state, action) => {
      // Update stake and recalculate totals
    },
  },
});
```

### Styling

**Tailwind CSS** with Desert Sunset token system:
- Dark mode: `dusk-*` purple palette with `gold`/`ember`/`terra-*`/`coral-*`/`plum` accents
- Light mode: `cream-*` / `sand-*` / `ink-*` palette
- Card treatments: `.ds-panel` (notched), `.ds-card-ink` (bordered), ticket stub (bet history)
- Fonts: `Press Start 2P` (display headings), `Space Grotesk` (body)

**Full Guide**: [Frontend Guide](Frontend-Guide.md)

---

## Backend

### API Architecture

```
src/
├── routes/                         # Express route handlers
│   ├── games.routes.ts
│   ├── bets.routes.ts
│   ├── admin.routes.ts
│   ├── auth.routes.ts
│   ├── api-keys.routes.ts
│   ├── futures.routes.ts
│   ├── stats.routes.ts
│   ├── mcp.routes.ts
│   ├── mcp-analytics.routes.ts
│   ├── analytics-clv.routes.ts
│   ├── analytics-sharp.routes.ts
│   ├── analytics-movements.routes.ts
│   ├── analytics-disagreement.routes.ts
│   ├── analytics-bookmaker.routes.ts
│   ├── analytics-arbitrage.routes.ts
│   └── analytics-correlation.routes.ts
├── services/                       # Business logic
│   ├── odds-sync.service.ts
│   ├── bet.service.ts
│   ├── outcome.service.ts
│   ├── game.service.ts
│   ├── line-movement.service.ts
│   ├── arbitrage.service.ts
│   ├── bookmaker-analytics.service.ts
│   ├── correlation.service.ts
│   ├── clv.service.ts
│   ├── sharp-indicator.service.ts
│   ├── market-consensus.service.ts
│   ├── stats-sync.service.ts
│   └── api-sports/                 # API-Sports per-sport services
│       ├── nba.service.ts
│       ├── nfl.service.ts
│       ├── ncaaf.service.ts
│       ├── nhl.service.ts
│       ├── mlb.service.ts
│       └── ncaab.service.ts
├── jobs/                           # Scheduled cron jobs
│   ├── odds-sync.job.ts
│   ├── outcome-resolver.job.ts
│   ├── arbitrage-scan.job.ts
│   ├── bookmaker-analytics.job.ts
│   ├── football-hourly-sync.job.ts
│   └── mlb-hourly-sync.job.ts
└── middleware/                     # Express middleware
    ├── auth-session.middleware.ts
    ├── api-key.middleware.ts
    ├── error.middleware.ts
    ├── validation.middleware.ts
    └── logger.middleware.ts
```

### API Endpoints

#### Games API

```typescript
GET /api/games
  Query: sport, date, timezoneOffset
  Returns: Game[]

GET /api/games/:id
  Returns: Game with teams and odds
```

#### Bets API

```typescript
POST /api/bets
  Body: { bets: BetInput[] }
  Returns: Created bets

GET /api/bets
  Query: status, limit
  Returns: Bet[]

GET /api/bets/stats
  Returns: Win rate, profit/loss, totals
```

#### Admin API

```typescript
POST /api/admin/init-sports
  Initialize sports in database

POST /api/admin/sync-odds
  Trigger background odds sync

POST /api/admin/resolve-outcomes
  Trigger background bet settlement

POST /api/admin/sync-teams
  Sync teams for all sports from API-Sports (background)

POST /api/admin/sync-football-hourly-window
  Trigger immediate NFL/NCAAF window sync (background)

GET /api/admin/football-sync-status
  Football hourly sync job status

GET /api/admin/stats
  Database statistics

GET /api/admin/health
  Health check with DB connectivity
```

### Background Jobs

#### Odds Sync Job

Runs approximately every 10 minutes to update odds from The Odds API. Emits an `odds-sync:completed` event on finish so downstream jobs (arbitrage scan) react immediately.

**Process**:
1. Fetch odds from The Odds API for all active sports
2. Upsert games in database
3. Create odds snapshots for time-series
4. Emit `odds-sync:completed` event
5. Log API usage (requests remaining)

#### Outcome Resolution Job

Runs hourly to settle pending bets based on game results.

**Process**:
1. Find completed games with pending bets
2. Fetch final scores from ESPN
3. Determine bet outcomes (won/lost/push)
4. Calculate payouts
5. Update bet status

#### Arbitrage Scan Job

Runs automatically after each odds sync (triggered by `odds-sync:completed` event). A 30-second cron pass expires stale opportunities and re-scans only if a sync notification was missed.

#### Bookmaker Analytics Job

Runs daily at 02:00 UTC. Computes value, sharpness, and reliability metrics for each bookmaker and persists them in `bookmaker_analytics`. Also runs immediately on startup if the table is empty or more than 48 hours stale.

#### Football Hourly Sync Job

Runs hourly, syncing NFL and NCAAF over a rolling window (96 h back / 72 h forward). Uses a re-entrancy guard and pauses on API-Sports quota exhaustion.

#### MLB Hourly Sync Job

Runs hourly, syncing MLB games over a rolling window. Shares the same pattern as the football sync job.

### Timezone Handling

All date filtering is timezone-aware:

```typescript
// Convert user's date to UTC range
const timezoneOffset = parseInt(req.query.timezoneOffset);
const userDate = new Date(req.query.date);
const startOfDayUTC = convertToUTC(userDate, timezoneOffset);
const endOfDayUTC = addDays(startOfDayUTC, 1);

// Query with UTC range
const games = await prisma.game.findMany({
  where: {
    commenceTime: {
      gte: startOfDayUTC,
      lt: endOfDayUTC,
    },
  },
});
```

**Full Guide**: [Backend Guide](Backend-Guide.md)

---

## Database

### Schema Overview

**Core Models**:
- `Sport` - Available sports leagues
- `Team` - Teams across all sports (153 teams: NFL, NBA, NHL, NCAAB, MLB)
- `Game` - Individual sporting events (shared between odds and stats sources via `game-resolver`)
- `Bet` / `BetLeg` - User bets and parlay legs
- `OddSnapshot` / `CurrentOdds` - Historical and current odds
- `MarketConsensus` - Bookmaker line consensus and dispersion metrics
- `SharpMoneyIndicator` - Steam move and reverse line movement data
- `BookmakerAnalytics` / `BookmakerMovementEvent` - Bookmaker performance data
- `ArbitrageOpportunity` - Detected arbitrage and middle opportunities
- `BetLegCorrelation` / `ParlayAnalysis` - Correlation analysis records

### Key Relationships

```prisma
model Game {
  id           String      @id @default(uuid())
  sport        String
  homeTeamId   String
  awayTeamId   String
  homeTeam     Team        @relation("HomeGames")
  awayTeam     Team        @relation("AwayGames")
  commenceTime DateTime
  bets         Bet[]
  oddSnapshots OddSnapshot[]
  
  @@index([sport, commenceTime])
}

model Bet {
  id       String   @id @default(uuid())
  gameId   String
  game     Game     @relation(fields: [gameId], references: [id])
  betType  String
  odds     Float
  stake    Float
  status   String   @default("pending")
  
  @@index([status, placedAt])
}
```

### Migrations

```bash
# Create migration
npm run prisma:migrate -- --name add_feature

# Apply migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Reset database (WARNING: deletes data)
npm run prisma:migrate reset
```

### Prisma Studio

Visual database browser:

```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

**Full Guide**: [Database Guide](Database-Guide.md)

---

## Features

### 1. Bet Slip Management

**User Flow**:
1. Browse games on home page
2. Click odds to add bet to slip
3. Enter stake amount — `ParlayValidator` checks for correlated legs in real time
4. Review potential payout (true-odds adjusted if correlation detected)
5. Submit bets to backend
6. Bets saved with "pending" status

**Redux State**:
```typescript
{
  bets: [
    {
      id: "uuid",
      gameId: "game-123",
      betType: "moneyline",
      odds: -150,
      stake: 100,
      team: "Lakers"
    }
  ],
  totalStake: 100,
  potentialPayout: 166.67
}
```

### 2. Line Movement Visualization

**Features**:
- Time-series charts with Recharts
- Multiple bookmakers on same chart
- Zoom and pan controls
- Hover tooltips with details
- Color-coded by bookmaker

**Data Source**: `OddSnapshot` table tracks all odds over time

### 3. Automated Bet Settlement

**Background Job**:
- Runs hourly
- Finds completed games
- Compares bet selections to final scores
- Updates bet status (won/lost/push)
- Calculates payouts

**Payout Calculation**:
```typescript
function calculatePayout(stake: number, odds: number): number {
  if (odds > 0) {
    // Positive odds: +150 means win $150 on $100 bet
    return stake * (odds / 100);
  } else {
    // Negative odds: -150 means bet $150 to win $100
    return stake * (100 / Math.abs(odds));
  }
}
```

### 4. Performance Analytics

**Statistics Tracked**:
- Total bets placed
- Total amount staked
- Total winnings
- Win rate percentage
- Profit/loss
- Pending bets count

**API Endpoint**:
```typescript
GET /api/bets/stats
{
  "totalBets": 150,
  "totalStaked": 15000,
  "totalWon": 16250,
  "winRate": 52.3,
  "profitLoss": 1250,
  "pendingBets": 23
}
```

### 5. Multi-Sport Support

**Supported Sports**:
- NFL (American Football)
- NBA (Basketball)
- NHL (Hockey)
- MLB (Baseball)
- NCAAB (College Basketball)
- EPL (English Premier League)
- UEFA Champions League

Each sport has:
- Dedicated odds sync
- Team reference data
- Sport-specific markets

### 6. Sharp Money Analytics

Live steam move and reverse line movement indicators at `/analytics/sharp`:
- Per-game sharp-confidence score (1-10 scale)
- Contrarian picks tab (sharp side opposing likely public side)
- Stats bar by movement type and market

### 7. Bookmaker Performance Analytics

Daily-computed rankings at `/analytics/bookmakers`:
- Value, sharpness, reliability, coverage, and limit profiles
- Side-by-side comparison for selected bookmakers
- Best-value bookmaker by sport
- Outlier detection based on consensus divergence

### 8. Arbitrage & Middle Detection

Real-time guaranteed-profit opportunity detection at `/analytics/arbitrage`:
- 2-way, 3-way, and middle opportunities
- Line-aware detection (prevents false arb from different lines)
- Stake calculator with per-leg guarantees
- Snapshot age badge (amber > 2.5 min, red > 5 min)
- In-app alert settings with local persistence

### 9. Parlay Correlation Analysis

Correlation-aware true-odds at `/analytics/correlation`:
- Real-time `ParlayValidator` in the bet slip (debounced on leg changes)
- Heatmap, hedge calculator, and education reference
- 4 correlation types: same-game, derivative, inverse (hard-blocked), temporal
- Stale-request guard so out-of-order responses don't overwrite current state

---

## Development

### Local Setup

**Backend**:
```bash
cd dashboard/backend
npm install
cp .env.example .env
npm run prisma:migrate
npm run dev
```

**Frontend**:
```bash
cd dashboard/frontend
npm install
echo "VITE_API_URL=http://localhost:3001/api" > .env
npm run dev
```

### Environment Variables

**Backend** (`.env`):
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/bettrack"
ODDS_API_KEY="your_api_key"
SESSION_SECRET="generate_with_openssl_rand"
PORT=3001
NODE_ENV=development
```

**Frontend** (`.env`):
```bash
VITE_API_URL=http://localhost:3001/api
```

### Testing

**Backend Tests** (Jest):
```bash
cd dashboard/backend
npm test
npm run test:watch
npm run test:coverage
```

**Frontend Tests** (Vitest):
```bash
cd dashboard/frontend
npm test
npm run test:watch
npm run test:ui
```

### Code Standards

**TypeScript**:
- Strict mode enabled
- Interface for all data types
- Async/await over callbacks
- Error handling with try/catch

**React**:
- Functional components with hooks
- TypeScript interfaces for props
- Named exports over default
- Tailwind CSS for styling

**Git Commits**:
```bash
feat(dashboard): add bet history filtering
fix(backend): resolve timezone calculation bug
docs(wiki): update dashboard guide
```

---

## Deployment

### Docker Build

Use the build script — it resolves versions, labels, platforms and the build
context for you:

```bash
cd dashboard
npm run docker:build -- backend
npm run docker:build -- all
npm run docker:dry
```

To build by hand, note that **the build context is `dashboard/`, not the
component directory**. Both Dockerfiles install from the shared workspace
lockfile (`COPY package*.json ./` then `COPY backend/package*.json ./backend/`),
so building from inside `dashboard/backend` fails:

```bash
cd dashboard
docker build -f backend/Dockerfile -t bettrack-backend .
docker run -p 3001:3001 -e DATABASE_URL=... bettrack-backend

docker build -f frontend/Dockerfile -t bettrack-frontend .
docker run -p 80:80 bettrack-frontend
```

### Docker Compose

```bash
cd dashboard
docker-compose up -d

# With production config
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Configuration

**Production** (`.env`):
```bash
DATABASE_URL="postgresql://user:pass@db-host:5432/bettrack"
ODDS_API_KEY="production_key"
SESSION_SECRET="secure_random_string_32_chars"
PORT=3001
NODE_ENV=production
CORS_ORIGIN="https://yourdomain.com"
```

### Pre-built Images

```bash
# Pull from GitHub Container Registry.
#   :latest      the newest release
#   :edge        the tip of main
#   :<version>   a specific released version
docker pull ghcr.io/wford26/bettrack/backend:latest
docker pull ghcr.io/wford26/bettrack/frontend:latest

# Run with compose
cd dashboard
docker-compose -f docker-compose.prod.yml up -d
```

### Database Migrations

```bash
# Run migrations in production
docker-compose exec backend npm run prisma:migrate

# Initialize sports
curl -X POST https://api.yourdomain.com/api/admin/init-sports

# Manual odds sync
curl -X POST https://api.yourdomain.com/api/admin/sync-odds
```

### Health Monitoring

```bash
# Backend health
curl https://api.yourdomain.com/api/admin/health

# Database stats
curl https://api.yourdomain.com/api/admin/stats
```

---

## API Reference

### Complete Endpoint List

**Games**:
- `GET /api/games` - List games with filters
- `GET /api/games/:id` - Get single game

**Bets**:
- `POST /api/bets` - Create bets
- `GET /api/bets` - List bets with filters
- `GET /api/bets/stats` - Betting statistics

**Odds**:
- `GET /api/odds/:gameId` - Get odds for game
- `GET /api/odds/:gameId/history` - Odds movement history

**Admin**:
- `POST /api/admin/init-sports` - Initialize sports
- `POST /api/admin/sync-odds` - Trigger odds sync
- `POST /api/admin/resolve-outcomes` - Trigger outcome resolution
- `GET /api/admin/stats` - Database statistics
- `GET /api/admin/health` - Health check

**Full Documentation**: [API Documentation](API-DOCUMENTATION.md)

---

## Related Guides

### Component-Specific

- **[Frontend Guide](Frontend-Guide.md)** - Detailed React architecture
- **[Backend Guide](Backend-Guide.md)** - Node.js API deep dive
- **[Database Guide](Database-Guide.md)** - Schema and queries

### General

- **[Quick Start](Quick-Start.md)** - Setup in 15 minutes
- **[Developer Guide](Developer-Guide.md)** - Contributing workflow
- **[MCP Server Guide](MCP-Server-Guide.md)** - Claude Desktop integration

---

## Troubleshooting

### Common Issues

**Backend won't start**:
- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running
- Run `npm run prisma:generate`

**Frontend can't connect to backend**:
- Check `VITE_API_URL` in `.env`
- Verify backend is running on correct port
- Check CORS settings in backend

**No games showing**:
- Run `POST /api/admin/init-sports`
- Run `POST /api/admin/sync-odds`
- Check `ODDS_API_KEY` is valid
- Verify API quota not exceeded

**Bet slip not working**:
- Check Redux DevTools for state
- Verify Redux store is configured
- Check browser console for errors

---

## Next Steps

- **Deploy to production** with Docker
- **Add custom features** (parlays, live betting)
- **Extend API** with new endpoints
- **Customize UI** with Tailwind
- **Add more sports** to odds sync

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: January 12, 2026
