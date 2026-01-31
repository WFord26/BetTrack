# BetTrack Sports Hub - Technical Implementation Specification

## Project Overview
Major redesign and feature expansion of the BetTrack platform with focus on improved UX, enhanced betting features, and monetization through API subscriptions.

**Technology Stack:**
- **Backend**: Node.js, Express.js, Prisma ORM
- **Frontend**: React, Redux/Redux Toolkit, Tailwind CSS
- **Database**: PostgreSQL
- **External APIs**: The Odds API, api-sports.io
- **Planned**: Redis (caching), MCP Gateway integration

---

## 1. DATABASE SCHEMA (Prisma)

### Schema Design Philosophy
- **Unique Game Identification**: Games are uniquely identified by `externalId` (from API) + `startTime` to handle rescheduled games
- **Historic Data Preservation**: All odds and stats are timestamped and immutable - never overwritten
- **Odds History**: Each odds update creates a new record with timestamp for historical tracking
- **Game Snapshots**: Game state is updated in place, but related data (odds, stats) is append-only

### Complete Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// CORE GAME DATA
// ============================================

model Game {
  id                String      @id @default(uuid())
  externalId        String      // ID from external API (Odds API or ESPN)
  sport             Sport
  league            String      // NFL, NBA, NHL, etc.
  
  homeTeam          String
  homeTeamId        String?     // External team ID
  awayTeam          String
  awayTeamId        String?     // External team ID
  
  startTime         DateTime
  originalStartTime DateTime?   // Track if game was rescheduled
  
  status            GameStatus  @default(SCHEDULED)
  season            Int?        // e.g., 2024, 2025
  week              Int?        // For NFL
  
  // Current Score (updated in real-time for live games)
  homeScore         Int?
  awayScore         Int?
  currentPeriod     String?     // "Q1", "3rd", "Bottom 9th", etc.
  
  // Game Details
  venue             String?
  venueCity         String?
  broadcastChannel  String?
  weather           Json?       // For outdoor sports
  
  // Relations
  odds              Odds[]
  oddsHistory       OddsHistory[]
  teamStats         TeamGameStats[]
  playerStats       PlayerGameStats[]
  userBets          UserBet[]
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  // Composite unique constraint: same external game + start time
  // This allows tracking rescheduled games separately
  @@unique([externalId, startTime])
  @@index([sport, startTime])
  @@index([status, startTime])
  @@index([league, season])
}

// ============================================
// ODDS DATA (CURRENT + HISTORY)
// ============================================

// Current/Latest odds for each game+sportsbook+market combination
model Odds {
  id            String      @id @default(uuid())
  gameId        String
  game          Game        @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  sportsbook    String      // fanduel, draftkings, betmgm, etc.
  marketType    MarketType
  
  // Moneyline
  homeMoneyline Int?
  awayMoneyline Int?
  
  // Spread
  homeSpread    Float?
  homeSpreadOdds Int?
  awaySpread    Float?
  awaySpreadOdds Int?
  
  // Total (Over/Under)
  overUnder     Float?
  overOdds      Int?
  underOdds     Int?
  
  // Player Props (stored as JSON for flexibility)
  playerProps   Json?
  
  lastUpdated   DateTime    @default(now())
  
  @@unique([gameId, sportsbook, marketType])
  @@index([gameId, sportsbook])
  @@index([lastUpdated])
}

// Historical odds for tracking line movement over time
model OddsHistory {
  id            String      @id @default(uuid())
  gameId        String
  game          Game        @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  sportsbook    String
  marketType    MarketType
  
  // Snapshot of odds at this timestamp
  homeMoneyline Int?
  awayMoneyline Int?
  homeSpread    Float?
  homeSpreadOdds Int?
  awaySpread    Float?
  awaySpreadOdds Int?
  overUnder     Float?
  overOdds      Int?
  underOdds     Int?
  playerProps   Json?
  
  timestamp     DateTime    @default(now())
  
  @@index([gameId, sportsbook, timestamp])
  @@index([timestamp])
}

// ============================================
// TEAM & PLAYER STATISTICS
// ============================================

model TeamGameStats {
  id          String   @id @default(uuid())
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  
  teamName    String
  teamId      String?
  isHome      Boolean
  
  // Sport-specific stats stored as JSON
  // Examples: 
  // NBA: { "points": 108, "rebounds": 45, "assists": 23, "fieldGoalPct": 0.456 }
  // NFL: { "totalYards": 345, "passingYards": 234, "rushingYards": 111, "turnovers": 2 }
  // NHL: { "shots": 32, "powerPlayGoals": 1, "faceoffWinPct": 0.52 }
  stats       Json
  
  // Pre-game or post-game snapshot
  snapshotType String  @default("live") // "pregame", "live", "final"
  timestamp    DateTime @default(now())
  
  @@index([gameId, teamName])
  @@index([teamId])
}

model PlayerGameStats {
  id          String   @id @default(uuid())
  gameId      String
  playerId    String
  playerName  String
  teamName    String
  
  // Sport-specific player stats as JSON
  // Examples:
  // NBA: { "points": 28, "rebounds": 7, "assists": 5, "minutes": 36 }
  // NFL: { "passingYards": 312, "touchdowns": 3, "interceptions": 1 }
  stats       Json
  
  timestamp   DateTime @default(now())
  
  @@index([gameId])
  @@index([playerId])
  @@index([gameId, playerId])
}

// ============================================
// TEAM REFERENCE DATA
// ============================================

model Team {
  id              String   @id @default(uuid())
  externalId      String   @unique
  name            String
  abbreviation    String
  city            String?
  sport           Sport
  league          String
  
  logo            String?
  colors          Json?    // Primary and secondary colors
  
  // Season stats (updated periodically)
  currentRecord   Json?    // { "wins": 10, "losses": 5, "ties": 0 }
  seasonStats     Json?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([sport, league])
  @@index([abbreviation])
}

// ============================================
// USER BETTING DATA
// ============================================

model UserBet {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  
  gameId          String
  game            Game        @relation(fields: [gameId], references: [id])
  
  sportsbook      String
  betType         BetType
  
  // Bet details
  stake           Float
  odds            Int         // American odds format
  potentialWin    Float
  
  // For spreads/totals
  line            Float?
  
  // For player props
  playerId        String?
  playerName      String?
  propType        String?     // "points", "rebounds", etc.
  propLine        Float?
  
  status          BetStatus   @default(PENDING)
  result          BetResult?
  actualWin       Float?
  
  placedAt        DateTime    @default(now())
  settledAt       DateTime?
  
  notes           String?
  
  @@index([userId, status])
  @@index([gameId])
  @@index([placedAt])
}

// ============================================
// API SUBSCRIPTIONS & USAGE
// ============================================

model User {
  id              String            @id @default(uuid())
  email           String            @unique
  username        String?           @unique
  passwordHash    String
  
  firstName       String?
  lastName        String?
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  // Relations
  subscription    ApiSubscription?
  bets            UserBet[]
  affiliateClicks AffiliateClick[]
}

model ApiSubscription {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  tier            SubscriptionTier @default(FREE)
  apiKey          String   @unique
  isActive        Boolean  @default(true)
  
  // Rate limiting
  dailyLimit      Int      @default(100)
  callsToday      Int      @default(0)
  lastResetDate   DateTime @default(now())
  
  // Billing
  stripeCustomerId String?
  stripeSubId      String?
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime?
  
  usageLogs       ApiUsageLog[]
  
  @@index([apiKey])
  @@index([userId])
}

model ApiUsageLog {
  id              String          @id @default(uuid())
  subscriptionId  String
  subscription    ApiSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  endpoint        String
  method          String
  queryParams     Json?
  
  timestamp       DateTime        @default(now())
  responseTime    Int             // milliseconds
  statusCode      Int
  
  ipAddress       String?
  userAgent       String?
  
  @@index([subscriptionId, timestamp])
  @@index([timestamp])
}

// ============================================
// AFFILIATE TRACKING
// ============================================

model AffiliateClick {
  id          String   @id @default(uuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  
  sportsbook  String
  gameId      String?
  betType     String?
  
  timestamp   DateTime @default(now())
  
  // Tracking
  clickId     String   @unique @default(uuid())
  converted   Boolean  @default(false)
  conversionValue Float?
  
  @@index([sportsbook, timestamp])
  @@index([userId])
}

// ============================================
// ENUMS
// ============================================

enum Sport {
  NFL
  NBA
  NHL
  NCAAF
  NCAAB
  MLB
  MLS
  EPL
  SOCCER
}

enum GameStatus {
  SCHEDULED
  LIVE
  FINAL
  POSTPONED
  CANCELLED
  SUSPENDED
}

enum MarketType {
  MONEYLINE
  SPREAD
  TOTAL
  PLAYER_PROPS
}

enum BetType {
  MONEYLINE
  SPREAD
  OVER
  UNDER
  PLAYER_PROP
  PARLAY
  TEASER
}

enum BetStatus {
  PENDING
  WON
  LOST
  PUSH
  VOID
}

enum BetResult {
  WIN
  LOSS
  PUSH
}

enum SubscriptionTier {
  FREE
  BASIC
  PRO
  ENTERPRISE
}
```

### Migration Commands

```bash
# Initialize Prisma (if not already done)
npx prisma init

# Create migration
npx prisma migrate dev --name initial_sports_hub_schema

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio to view data
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# Seed database with sample data
npx prisma db seed
```

### Sample Seed File

```javascript
// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create sample teams
  const lakers = await prisma.team.create({
    data: {
      externalId: 'nba-lal',
      name: 'Los Angeles Lakers',
      abbreviation: 'LAL',
      city: 'Los Angeles',
      sport: 'NBA',
      league: 'NBA',
      currentRecord: { wins: 25, losses: 20 }
    }
  });

  const celtics = await prisma.team.create({
    data: {
      externalId: 'nba-bos',
      name: 'Boston Celtics',
      abbreviation: 'BOS',
      city: 'Boston',
      sport: 'NBA',
      league: 'NBA',
      currentRecord: { wins: 30, losses: 15 }
    }
  });

  // Create sample game
  const game = await prisma.game.create({
    data: {
      externalId: 'nba-20260128-lal-bos',
      sport: 'NBA',
      league: 'NBA',
      homeTeam: 'Boston Celtics',
      homeTeamId: celtics.externalId,
      awayTeam: 'Los Angeles Lakers',
      awayTeamId: lakers.externalId,
      startTime: new Date('2026-01-28T19:00:00Z'),
      status: 'SCHEDULED',
      season: 2026,
      venue: 'TD Garden',
      venueCity: 'Boston',
      broadcastChannel: 'TNT'
    }
  });

  // Create sample odds
  await prisma.odds.create({
    data: {
      gameId: game.id,
      sportsbook: 'fanduel',
      marketType: 'MONEYLINE',
      homeMoneyline: -150,
      awayMoneyline: 130,
      lastUpdated: new Date()
    }
  });

  await prisma.odds.create({
    data: {
      gameId: game.id,
      sportsbook: 'fanduel',
      marketType: 'SPREAD',
      homeSpread: -3.5,
      homeSpreadOdds: -110,
      awaySpread: 3.5,
      awaySpreadOdds: -110,
      lastUpdated: new Date()
    }
  });

  await prisma.odds.create({
    data: {
      gameId: game.id,
      sportsbook: 'draftkings',
      marketType: 'TOTAL',
      overUnder: 223.5,
      overOdds: -110,
      underOdds: -110,
      lastUpdated: new Date()
    }
  });

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 2. BACKEND API ENDPOINTS (Express.js)

### Project Structure

```
server/
├── index.js                    # Entry point
├── routes/
│   ├── games.js               # Game endpoints
│   ├── odds.js                # Odds endpoints
│   ├── stats.js               # Statistics endpoints
│   ├── subscriptions.js       # API subscription management
│   └── api/                   # Public API routes (require API key)
│       ├── index.js
│       ├── games.js
│       └── odds.js
├── controllers/
│   ├── gamesController.js
│   ├── oddsController.js
│   ├── statsController.js
│   └── subscriptionController.js
├── services/
│   ├── oddsApiService.js      # The Odds API integration
│   ├── sportsApiService.js    # api-sports.io integration
│   ├── cacheService.js        # Redis caching layer
│   ├── affiliateService.js    # Affiliate link generation
│   └── oddsHistoryService.js  # Odds history tracking
├── middleware/
│   ├── auth.js                # User authentication
│   ├── apiKeyAuth.js          # API key validation
│   ├── rateLimit.js           # Rate limiting
│   └── errorHandler.js        # Global error handler
├── utils/
│   ├── oddsFormatter.js
│   ├── sportMapper.js
│   └── logger.js
└── jobs/
    ├── oddsSync.js            # Cron job for odds sync
    ├── scoresUpdate.js        # Live score updates
    └── oddsHistory.js         # Archive odds to history
```

### Server Entry Point

```javascript
// server/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const gamesRoutes = require('./routes/games');
const oddsRoutes = require('./routes/odds');
const statsRoutes = require('./routes/stats');
const subscriptionRoutes = require('./routes/subscriptions');
const publicApiRoutes = require('./routes/api');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import jobs
require('./jobs/oddsSync');
require('./jobs/scoresUpdate');
require('./jobs/oddsHistory');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/games', gamesRoutes);
app.use('/api/odds', oddsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Public API routes (require API key)
app.use('/api/v1', publicApiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### Games Controller (Complete)

```javascript
// controllers/gamesController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cacheService = require('../services/cacheService');
const sportsApiService = require('../services/sportsApiService');

/**
 * GET /api/games
 * Get filtered games with pagination and sorting
 */
exports.getFilteredGames = async (req, res, next) => {
  try {
    const {
      sport,
      status = 'SCHEDULED,LIVE',
      startDate,
      endDate,
      league,
      sort = 'startTime:asc',
      limit = 20,
      offset = 0
    } = req.query;

    // Build Prisma where clause
    const where = {};
    
    if (sport) {
      const sports = sport.split(',');
      where.sport = { in: sports };
    }
    
    if (status) {
      const statuses = status.split(',');
      where.status = { in: statuses };
    }
    
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }
    
    if (league) {
      where.league = league;
    }

    // Parse sort parameter
    const [sortField, sortOrder] = sort.split(':');
    const orderBy = { [sortField]: sortOrder || 'asc' };

    // Check cache
    const cacheKey = `games:${JSON.stringify(where)}:${sort}:${limit}:${offset}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Query database
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        orderBy,
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          odds: {
            orderBy: { lastUpdated: 'desc' },
            distinct: ['sportsbook', 'marketType'],
          }
        }
      }),
      prisma.game.count({ where })
    ]);

    const result = {
      games,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + games.length < total
      }
    };

    // Cache for 2 minutes
    await cacheService.set(cacheKey, result, 120);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/games/:id
 * Get detailed game information
 */
exports.getGameDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `game:${id}:details`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        odds: {
          orderBy: { lastUpdated: 'desc' }
        },
        teamStats: {
          orderBy: { timestamp: 'desc' }
        },
        playerStats: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Fetch real-time updates if game is live
    if (game.status === 'LIVE') {
      const liveData = await sportsApiService.getLiveGameData(
        game.sport,
        game.externalId
      );
      
      // Update game in background
      prisma.game.update({
        where: { id },
        data: {
          homeScore: liveData.homeScore,
          awayScore: liveData.awayScore,
          currentPeriod: liveData.period,
          status: liveData.status,
          updatedAt: new Date()
        }
      }).catch(console.error);
      
      // Update response with live data
      game.homeScore = liveData.homeScore;
      game.awayScore = liveData.awayScore;
      game.currentPeriod = liveData.period;
    }

    // Cache with shorter TTL for live games
    const ttl = game.status === 'LIVE' ? 30 : 300;
    await cacheService.set(cacheKey, game, ttl);

    res.json(game);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/games/upcoming
 * Get upcoming games with lazy loading support
 */
exports.getUpcomingGames = async (req, res, next) => {
  try {
    const {
      sport,
      limit = 20,
      offset = 0
    } = req.query;

    const where = {
      status: 'SCHEDULED',
      startTime: { gte: new Date() }
    };

    if (sport) {
      where.sport = sport;
    }

    const games = await prisma.game.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        odds: {
          distinct: ['sportsbook'],
          orderBy: { lastUpdated: 'desc' }
        }
      }
    });

    const total = await prisma.game.count({ where });

    res.json({
      games,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + games.length < total
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/games/:id/odds-history
 * Get historical odds for a game
 */
exports.getOddsHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sportsbook, marketType } = req.query;

    const where = { gameId: id };
    if (sportsbook) where.sportsbook = sportsbook;
    if (marketType) where.marketType = marketType;

    const history = await prisma.oddsHistory.findMany({
      where,
      orderBy: { timestamp: 'asc' }
    });

    res.json(history);
  } catch (error) {
    next(error);
  }
};
```

### Odds API Service (Integration)

```javascript
// services/oddsApiService.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

class OddsApiService {
  /**
   * Fetch current odds for a sport
   */
  async fetchOddsForSport(sport, regions = 'us', markets = 'h2h,spreads,totals') {
    try {
      const response = await axios.get(`${BASE_URL}/sports/${sport}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions,
          markets,
          oddsFormat: 'american',
          dateFormat: 'iso'
        }
      });

      console.log(`✅ Fetched odds for ${sport}: ${response.data.length} games`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching odds for ${sport}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync odds to database
   * Creates/updates games and odds records
   */
  async syncOddsToDatabase(sport) {
    try {
      const oddsData = await this.fetchOddsForSport(sport);
      
      for (const event of oddsData) {
        // Find or create game
        const gameData = {
          externalId: event.id,
          sport: this.mapSportKey(sport),
          league: sport.toUpperCase(),
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          startTime: new Date(event.commence_time),
          status: new Date(event.commence_time) > new Date() ? 'SCHEDULED' : 'LIVE',
          season: new Date(event.commence_time).getFullYear()
        };

        const game = await prisma.game.upsert({
          where: {
            externalId_startTime: {
              externalId: event.id,
              startTime: new Date(event.commence_time)
            }
          },
          update: gameData,
          create: gameData
        });

        // Process odds for each bookmaker
        for (const bookmaker of event.bookmakers) {
          for (const market of bookmaker.markets) {
            await this.upsertOdds(game.id, bookmaker.key, market, event.home_team, event.away_team);
          }
        }
      }

      console.log(`✅ Synced ${oddsData.length} games for ${sport}`);
    } catch (error) {
      console.error(`❌ Error syncing ${sport}:`, error.message);
      throw error;
    }
  }

  /**
   * Upsert odds (create or update)
   * Also archives to odds history
   */
  async upsertOdds(gameId, sportsbook, market, homeTeam, awayTeam) {
    const marketType = this.mapMarketType(market.key);
    
    const oddsData = {
      gameId,
      sportsbook,
      marketType,
      lastUpdated: new Date()
    };

    // Map market outcomes to odds fields
    if (market.key === 'h2h') {
      const home = market.outcomes.find(o => o.name === homeTeam);
      const away = market.outcomes.find(o => o.name === awayTeam);
      oddsData.homeMoneyline = home?.price;
      oddsData.awayMoneyline = away?.price;
    } else if (market.key === 'spreads') {
      market.outcomes.forEach(outcome => {
        if (outcome.name === homeTeam) {
          oddsData.homeSpread = outcome.point;
          oddsData.homeSpreadOdds = outcome.price;
        } else {
          oddsData.awaySpread = outcome.point;
          oddsData.awaySpreadOdds = outcome.price;
        }
      });
    } else if (market.key === 'totals') {
      const over = market.outcomes.find(o => o.name === 'Over');
      const under = market.outcomes.find(o => o.name === 'Under');
      oddsData.overUnder = over?.point;
      oddsData.overOdds = over?.price;
      oddsData.underOdds = under?.price;
    }

    // Upsert current odds
    const odds = await prisma.odds.upsert({
      where: {
        gameId_sportsbook_marketType: {
          gameId,
          sportsbook,
          marketType
        }
      },
      update: oddsData,
      create: oddsData
    });

    // Archive to history (don't await - fire and forget)
    prisma.oddsHistory.create({
      data: {
        gameId,
        sportsbook,
        marketType,
        homeMoneyline: oddsData.homeMoneyline,
        awayMoneyline: oddsData.awayMoneyline,
        homeSpread: oddsData.homeSpread,
        homeSpreadOdds: oddsData.homeSpreadOdds,
        awaySpread: oddsData.awaySpread,
        awaySpreadOdds: oddsData.awaySpreadOdds,
        overUnder: oddsData.overUnder,
        overOdds: oddsData.overOdds,
        underOdds: oddsData.underOdds,
        timestamp: new Date()
      }
    }).catch(err => console.error('Error archiving odds:', err));

    return odds;
  }

  /**
   * Map API sport keys to internal enum values
   */
  mapSportKey(apiKey) {
    const mapping = {
      'americanfootball_nfl': 'NFL',
      'basketball_nba': 'NBA',
      'icehockey_nhl': 'NHL',
      'americanfootball_ncaaf': 'NCAAF',
      'basketball_ncaab': 'NCAAB',
      'baseball_mlb': 'MLB',
      'soccer_epl': 'EPL'
    };
    return mapping[apiKey] || apiKey.toUpperCase();
  }

  /**
   * Map market keys to internal enum values
   */
  mapMarketType(key) {
    const mapping = {
      'h2h': 'MONEYLINE',
      'spreads': 'SPREAD',
      'totals': 'TOTAL'
    };
    return mapping[key] || key.toUpperCase();
  }
}

module.exports = new OddsApiService();
```

### Redis Cache Service

```javascript
// services/cacheService.js
const redis = require('redis');

class CacheService {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => console.log('✅ Redis connected'));

    this.connect();
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async get(key) {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async flush() {
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }
}

module.exports = new CacheService();
```

### Background Jobs (Cron)

```javascript
// jobs/oddsSync.js
const cron = require('node-cron');
const oddsApiService = require('../services/oddsApiService');

const SPORTS = [
  'americanfootball_nfl',
  'basketball_nba',
  'icehockey_nhl',
  'americanfootball_ncaaf',
  'basketball_ncaab'
];

// Sync odds every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Starting odds sync...');
  
  for (const sport of SPORTS) {
    try {
      await oddsApiService.syncOddsToDatabase(sport);
    } catch (error) {
      console.error(`Error syncing ${sport}:`, error.message);
    }
  }
  
  console.log('✅ Odds sync completed');
});

console.log('⏰ Odds sync cron job initialized');
```

```javascript
// jobs/scoresUpdate.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const sportsApiService = require('../services/sportsApiService');
const prisma = new PrismaClient();

// Update live game scores every minute
cron.schedule('* * * * *', async () => {
  try {
    const liveGames = await prisma.game.findMany({
      where: { status: 'LIVE' },
      select: { id: true, sport: true, externalId: true }
    });

    if (liveGames.length === 0) return;

    console.log(`🔴 Updating ${liveGames.length} live games...`);

    for (const game of liveGames) {
      try {
        const liveData = await sportsApiService.getLiveGameData(
          game.sport,
          game.externalId
        );
        
        await prisma.game.update({
          where: { id: game.id },
          data: {
            homeScore: liveData.homeScore,
            awayScore: liveData.awayScore,
            currentPeriod: liveData.period,
            status: liveData.status,
            updatedAt: new Date()
          }
        });
      } catch (error) {
        console.error(`Error updating game ${game.id}:`, error.message);
      }
    }

    console.log('✅ Live scores updated');
  } catch (error) {
    console.error('Error in scores update job:', error.message);
  }
});

console.log('⏰ Live scores update cron job initialized');
```

---

## 3. FRONTEND IMPLEMENTATION (React + Redux)

### Project Structure

```
client/
├── public/
│   ├── assets/
│   │   ├── cowboy-dollar.svg
│   │   └── pixel-icons/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── Navigation.jsx
│   │   ├── games/
│   │   │   ├── GameCard.jsx
│   │   │   ├── GameFilters.jsx
│   │   │   ├── GameList.jsx
│   │   │   └── LazyGameList.jsx
│   │   ├── game-details/
│   │   │   ├── GameHeader.jsx
│   │   │   ├── TeamStatsPanel.jsx
│   │   │   ├── OddsComparison.jsx
│   │   │   ├── OddsHistoryChart.jsx
│   │   │   └── PlayerStatsTable.jsx
│   │   └── common/
│   │       ├── PixelButton.jsx
│   │       ├── RetroCard.jsx
│   │       ├── LoadingSpinner.jsx
│   │       └── TexasLogo.jsx
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── GamesPage.jsx
│   │   ├── GameDetailsPage.jsx
│   │   ├── ArchivePage.jsx
│   │   └── DashboardPage.jsx
│   ├── redux/
│   │   ├── store.js
│   │   ├── slices/
│   │   │   ├── gamesSlice.js
│   │   │   ├── filtersSlice.js
│   │   │   └── userSlice.js
│   │   └── api/
│   │       ├── gamesApi.js
│   │       └── oddsApi.js
│   ├── styles/
│   │   ├── index.css
│   │   ├── retro.css
│   │   └── pixel-art.css
│   ├── utils/
│   │   ├── oddsFormatter.js
│   │   ├── affiliateLinks.js
│   │   └── sportIcons.js
│   ├── App.jsx
│   └── main.jsx
```

### Redux Store Setup

```javascript
// redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import gamesReducer from './slices/gamesSlice';
import filtersReducer from './slices/filtersSlice';
import userReducer from './slices/userSlice';
import { gamesApi } from './api/gamesApi';

export const store = configureStore({
  reducer: {
    games: gamesReducer,
    filters: filtersReducer,
    user: userReducer,
    [gamesApi.reducerPath]: gamesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(gamesApi.middleware),
});
```

### RTK Query API Slice

```javascript
// redux/api/gamesApi.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const gamesApi = createApi({
  reducerPath: 'gamesApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Game', 'Odds', 'Stats'],
  endpoints: (builder) => ({
    // Get filtered games
    getFilteredGames: builder.query({
      query: (filters) => ({
        url: '/games',
        params: filters,
      }),
      providesTags: (result) =>
        result?.games
          ? [
              ...result.games.map(({ id }) => ({ type: 'Game', id })),
              { type: 'Game', id: 'LIST' },
            ]
          : [{ type: 'Game', id: 'LIST' }],
    }),
    
    // Get single game details
    getGameDetails: builder.query({
      query: (id) => `/games/${id}`,
      providesTags: (result, error, id) => [{ type: 'Game', id }],
      // Refetch every 30 seconds for live games
      pollingInterval: (data) => 
        data?.status === 'LIVE' ? 30000 : 0,
    }),
    
    // Get upcoming games with infinite scroll
    getUpcomingGames: builder.query({
      query: ({ limit = 20, offset = 0, sport }) => ({
        url: '/games/upcoming',
        params: { limit, offset, sport },
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        return `${endpointName}-${queryArgs.sport || 'all'}`;
      },
      merge: (currentCache, newItems) => {
        currentCache.games.push(...newItems.games);
        currentCache.pagination = newItems.pagination;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg?.offset !== previousArg?.offset;
      },
      providesTags: ['Game'],
    }),

    // Get odds history
    getOddsHistory: builder.query({
      query: ({ gameId, sportsbook, marketType }) => ({
        url: `/games/${gameId}/odds-history`,
        params: { sportsbook, marketType },
      }),
      providesTags: (result, error, { gameId }) => [
        { type: 'Odds', id: gameId }
      ],
    }),
  }),
});

export const {
  useGetFilteredGamesQuery,
  useGetGameDetailsQuery,
  useGetUpcomingGamesQuery,
  useGetOddsHistoryQuery,
} = gamesApi;
```

### Filters Slice

```javascript
// redux/slices/filtersSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sports: [],
  status: 'SCHEDULED,LIVE',
  startDate: null,
  endDate: null,
  league: null,
  sort: 'startTime:asc',
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    toggleSport: (state, action) => {
      const sport = action.payload;
      if (state.sports.includes(sport)) {
        state.sports = state.sports.filter(s => s !== sport);
      } else {
        state.sports.push(sport);
      }
    },
    setFilters: (state, action) => {
      return { ...state, ...action.payload };
    },
    resetFilters: () => initialState,
  },
});

export const { toggleSport, setFilters, resetFilters } = filtersSlice.actions;
export default filtersSlice.reducer;
```

### Game Filters Component

```javascript
// components/games/GameFilters.jsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFilters, toggleSport } from '../../redux/slices/filtersSlice';

const SPORTS = ['NFL', 'NBA', 'NHL', 'NCAAF', 'NCAAB', 'MLB'];

export const GameFilters = () => {
  const dispatch = useDispatch();
  const filters = useSelector((state) => state.filters);

  return (
    <div className="retro-panel p-4 mb-6">
      <h3 className="pixel-text text-xl mb-4">🎮 FILTER GAMES</h3>
      
      {/* Sport Checkboxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {SPORTS.map((sport) => (
          <label
            key={sport}
            className="flex items-center space-x-2 cursor-pointer pixel-checkbox"
          >
            <input
              type="checkbox"
              checked={filters.sports.includes(sport)}
              onChange={() => dispatch(toggleSport(sport))}
              className="form-checkbox h-5 w-5"
            />
            <span className="text-sm font-bold">{sport}</span>
          </label>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => dispatch(setFilters({ status: 'LIVE' }))}
          className={`pixel-button ${
            filters.status === 'LIVE' ? 'active' : ''
          }`}
        >
          🔴 LIVE
        </button>
        <button
          onClick={() => dispatch(setFilters({ status: 'SCHEDULED' }))}
          className={`pixel-button ${
            filters.status === 'SCHEDULED' ? 'active' : ''
          }`}
        >
          📅 UPCOMING
        </button>
        <button
          onClick={() => dispatch(setFilters({ status: 'FINAL' }))}
          className={`pixel-button ${
            filters.status === 'FINAL' ? 'active' : ''
          }`}
        >
          ✅ FINAL
        </button>
        <button
          onClick={() => dispatch(setFilters({ status: 'SCHEDULED,LIVE' }))}
          className={`pixel-button ${
            filters.status === 'SCHEDULED,LIVE' ? 'active' : ''
          }`}
        >
          🎯 ALL ACTIVE
        </button>
      </div>

      {/* Sort Options */}
      <select
        value={filters.sort}
        onChange={(e) => dispatch(setFilters({ sort: e.target.value }))}
        className="retro-select w-full md:w-64"
      >
        <option value="startTime:asc">⏰ Earliest First</option>
        <option value="startTime:desc">⏰ Latest First</option>
        <option value="homeTeam:asc">🏠 Home Team A-Z</option>
        <option value="sport:asc">🏈 By Sport</option>
      </select>
    </div>
  );
};
```

### Lazy Loading Game List

```javascript
// components/games/LazyGameList.jsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGetUpcomingGamesQuery } from '../../redux/api/gamesApi';
import { GameCard } from './GameCard';

export const LazyGameList = ({ sport }) => {
  const [offset, setOffset] = useState(0);
  const observerTarget = useRef(null);

  const { data, isLoading, isFetching, error } = useGetUpcomingGamesQuery({
    limit: 20,
    offset,
    sport,
  });

  const handleObserver = useCallback(
    (entries) => {
      const [target] = entries;
      if (target.isIntersecting && !isFetching && data?.pagination?.hasMore) {
        setOffset((prev) => prev + 20);
      }
    },
    [isFetching, data]
  );

  useEffect(() => {
    const element = observerTarget.current;
    const option = { threshold: 0.1 };

    const observer = new IntersectionObserver(handleObserver, option);
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  if (error) {
    return (
      <div className="retro-panel p-8 text-center">
        <p className="text-red-500 pixel-text">Error loading games</p>
      </div>
    );
  }

  return (
    <div>
      {isLoading && offset === 0 ? (
        <div className="flex justify-center py-12">
          <div className="pixel-spinner-large"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>

          {/* Loading indicator for pagination */}
          {isFetching && (
            <div className="flex justify-center py-8">
              <div className="pixel-spinner"></div>
            </div>
          )}

          {/* Intersection observer target */}
          <div ref={observerTarget} className="h-10" />
        </>
      )}
    </div>
  );
};
```

### Game Card Component

```javascript
// components/games/GameCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { formatOdds } from '../../utils/oddsFormatter';

export const GameCard = ({ game }) => {
  const bestOdds = game.odds?.find(o => o.marketType === 'MONEYLINE');

  return (
    <Link to={`/games/${game.id}`}>
      <div className="pixel-card hover:scale-105 transition-transform">
        {/* Status Badge */}
        <div className="flex justify-between items-center mb-3">
          <span className={`pixel-badge ${game.status.toLowerCase()}`}>
            {game.status === 'LIVE' && <span className="live-indicator mr-2"></span>}
            {game.status}
          </span>
          <span className="text-xs opacity-75">{game.sport}</span>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold">{game.awayTeam}</span>
            {game.status === 'LIVE' || game.status === 'FINAL' ? (
              <span className="text-2xl font-bold">{game.awayScore}</span>
            ) : bestOdds && (
              <span className="odds-display">
                {formatOdds(bestOdds.awayMoneyline)}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="font-bold">{game.homeTeam}</span>
            {game.status === 'LIVE' || game.status === 'FINAL' ? (
              <span className="text-2xl font-bold">{game.homeScore}</span>
            ) : bestOdds && (
              <span className="odds-display">
                {formatOdds(bestOdds.homeMoneyline)}
              </span>
            )}
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-3 pt-3 border-t-2 border-black text-xs">
          <div className="flex justify-between">
            <span>{new Date(game.startTime).toLocaleDateString()}</span>
            <span>{new Date(game.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          {game.broadcastChannel && (
            <div className="mt-1 text-center opacity-75">
              📺 {game.broadcastChannel}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
```

### Game Details Page

```javascript
// pages/GameDetailsPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useGetGameDetailsQuery } from '../redux/api/gamesApi';
import { TeamStatsPanel } from '../components/game-details/TeamStatsPanel';
import { OddsComparison } from '../components/game-details/OddsComparison';
import { PlayerStatsTable } from '../components/game-details/PlayerStatsTable';

export const GameDetailsPage = () => {
  const { id } = useParams();
  const { data: game, isLoading, error } = useGetGameDetailsQuery(id);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="pixel-spinner-large"></div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="retro-panel p-8 text-center">
          <h2 className="pixel-text text-2xl mb-4">Game Not Found</h2>
          <Link to="/games" className="pixel-button">
            ← Back to Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Game Header */}
      <div className="retro-panel mb-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <span className={`pixel-badge ${game.status.toLowerCase()}`}>
            {game.status === 'LIVE' && <span className="live-indicator mr-2"></span>}
            {game.status}
          </span>
          <span className="text-sm opacity-75">
            {game.sport} • {game.league}
          </span>
        </div>

        <div className="flex justify-between items-center">
          {/* Away Team */}
          <div className="text-center flex-1">
            <h2 className="pixel-text text-xl md:text-2xl mb-2">
              {game.awayTeam}
            </h2>
            <div className="text-4xl md:text-6xl font-bold">
              {game.awayScore ?? '-'}
            </div>
          </div>
          
          {/* VS / Period */}
          <div className="px-4 md:px-8 text-center">
            <div className="text-lg md:text-xl font-bold">
              {game.currentPeriod || 'VS'}
            </div>
            <div className="text-xs md:text-sm mt-2 opacity-75">
              {new Date(game.startTime).toLocaleString()}
            </div>
            {game.venue && (
              <div className="text-xs mt-1 opacity-75">
                📍 {game.venue}
              </div>
            )}
          </div>
          
          {/* Home Team */}
          <div className="text-center flex-1">
            <h2 className="pixel-text text-xl md:text-2xl mb-2">
              {game.homeTeam}
            </h2>
            <div className="text-4xl md:text-6xl font-bold">
              {game.homeScore ?? '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Away Team Stats - 1/4 */}
        <div className="col-span-12 md:col-span-3">
          <TeamStatsPanel 
            team={game.awayTeam}
            stats={game.teamStats?.find(s => !s.isHome)}
            isHome={false}
          />
        </div>

        {/* Home Team Stats - 1/4 */}
        <div className="col-span-12 md:col-span-3">
          <TeamStatsPanel 
            team={game.homeTeam}
            stats={game.teamStats?.find(s => s.isHome)}
            isHome={true}
          />
        </div>

        {/* Game Info & Odds - 2/4 to 3/4 */}
        <div className="col-span-12 md:col-span-6">
          {/* Odds Comparison */}
          <OddsComparison odds={game.odds} gameId={game.id} />

          {/* Player Stats */}
          {game.playerStats?.length > 0 && (
            <PlayerStatsTable 
              playerStats={game.playerStats}
              sport={game.sport}
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

### Odds Comparison Component

```javascript
// components/game-details/OddsComparison.jsx
import React from 'react';
import { affiliateService } from '../../utils/affiliateLinks';

export const OddsComparison = ({ odds, gameId }) => {
  const handleBetClick = (sportsbook, betType) => {
    const link = affiliateService.generateLink(sportsbook, gameId, betType);
    if (link) {
      window.open(link, '_blank');
      
      // Track click
      fetch('/api/affiliate/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sportsbook, gameId, betType })
      }).catch(console.error);
    }
  };

  // Group odds by sportsbook
  const oddsMap = odds.reduce((acc, odd) => {
    if (!acc[odd.sportsbook]) {
      acc[odd.sportsbook] = {};
    }
    acc[odd.sportsbook][odd.marketType] = odd;
    return acc;
  }, {});

  const sportsbooks = Object.keys(oddsMap);

  if (sportsbooks.length === 0) {
    return (
      <div className="retro-panel p-4 mb-6">
        <p className="text-center opacity-75">No odds available</p>
      </div>
    );
  }

  return (
    <div className="retro-panel p-4 mb-6">
      <h3 className="pixel-text text-lg mb-4">📊 ODDS COMPARISON</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left p-2">Book</th>
              <th className="p-2">ML</th>
              <th className="p-2">Spread</th>
              <th className="p-2">Total</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {sportsbooks.map((sportsbook) => {
              const markets = oddsMap[sportsbook];
              return (
                <tr key={sportsbook} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="p-2 font-bold capitalize">
                    {sportsbook}
                  </td>
                  
                  {/* Moneyline */}
                  <td className="p-2 text-center">
                    {markets.MONEYLINE ? (
                      <div className="flex flex-col">
                        <span className={markets.MONEYLINE.awayMoneyline > 0 ? 'odds-positive' : 'odds-negative'}>
                          {markets.MONEYLINE.awayMoneyline > 0 ? '+' : ''}{markets.MONEYLINE.awayMoneyline}
                        </span>
                        <span className={markets.MONEYLINE.homeMoneyline > 0 ? 'odds-positive' : 'odds-negative'}>
                          {markets.MONEYLINE.homeMoneyline > 0 ? '+' : ''}{markets.MONEYLINE.homeMoneyline}
                        </span>
                      </div>
                    ) : '-'}
                  </td>

                  {/* Spread */}
                  <td className="p-2 text-center text-xs">
                    {markets.SPREAD ? (
                      <div className="flex flex-col">
                        <span>
                          {markets.SPREAD.awaySpread > 0 ? '+' : ''}{markets.SPREAD.awaySpread} 
                          <span className="opacity-75"> ({markets.SPREAD.awaySpreadOdds})</span>
                        </span>
                        <span>
                          {markets.SPREAD.homeSpread > 0 ? '+' : ''}{markets.SPREAD.homeSpread} 
                          <span className="opacity-75"> ({markets.SPREAD.homeSpreadOdds})</span>
                        </span>
                      </div>
                    ) : '-'}
                  </td>

                  {/* Total */}
                  <td className="p-2 text-center text-xs">
                    {markets.TOTAL ? (
                      <div className="flex flex-col">
                        <span>O {markets.TOTAL.overUnder} <span className="opacity-75">({markets.TOTAL.overOdds})</span></span>
                        <span>U {markets.TOTAL.overUnder} <span className="opacity-75">({markets.TOTAL.underOdds})</span></span>
                      </div>
                    ) : '-'}
                  </td>

                  {/* Bet Button */}
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleBetClick(sportsbook, 'h2h')}
                      className="pixel-button text-xs py-1 px-2"
                    >
                      BET
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs opacity-75 mt-4 text-center">
        Last updated: {new Date(odds[0]?.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};
```

---

## 4. VISUAL DESIGN SYSTEM

### Tailwind Configuration

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          red: '#E63946',
          darkRed: '#A4161A',
          cream: '#F1FAEE',
          teal: '#1D3557',
          blue: '#457B9D',
          yellow: '#FFD60A',
        },
        pixel: {
          white: '#FFFFFF',
          black: '#000000',
          gray: '#808080',
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        retro: ['"VT323"', 'monospace'],
      },
      boxShadow: {
        'pixel': '4px 4px 0px 0px rgba(0,0,0,0.25)',
        'pixel-hover': '6px 6px 0px 0px rgba(0,0,0,0.35)',
        'retro': '4px 4px 0px 0px #E63946, 8px 8px 0px 0px rgba(0,0,0,0.3)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'blink': 'blink 1s steps(2) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        blink: {
          '50%': { opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
```

### Pixel Art CSS

```css
/* styles/pixel-art.css */

@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

/* ============================================
   GLOBAL STYLES
   ============================================ */

* {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

body {
  background: linear-gradient(135deg, #1D3557 0%, #457B9D 100%);
  min-height: 100vh;
}

/* ============================================
   TYPOGRAPHY
   ============================================ */

.pixel-text {
  font-family: 'Press Start 2P', cursive;
  text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.05em;
  line-height: 1.5;
}

.retro-text {
  font-family: 'VT323', monospace;
  font-size: 1.25rem;
}

/* ============================================
   PANELS & CARDS
   ============================================ */

.retro-panel {
  background: linear-gradient(145deg, #F1FAEE 0%, #ffffff 100%);
  border: 4px solid #000;
  box-shadow: 
    4px 4px 0px 0px #E63946,
    8px 8px 0px 0px rgba(0,0,0,0.3);
  transition: all 0.2s ease;
  position: relative;
}

.retro-panel:hover {
  transform: translate(-2px, -2px);
  box-shadow: 
    6px 6px 0px 0px #E63946,
    10px 10px 0px 0px rgba(0,0,0,0.3);
}

.pixel-card {
  background: #F1FAEE;
  border: 4px solid #000;
  padding: 16px;
  position: relative;
  box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.3);
  transition: all 0.2s ease;
}

.pixel-card::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 2px solid #E63946;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.pixel-card:hover::before {
  opacity: 1;
}

.pixel-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px 0px rgba(0,0,0,0.4);
}

/* ============================================
   BUTTONS
   ============================================ */

.pixel-button {
  font-family: 'Press Start 2P', cursive;
  padding: 12px 24px;
  background: #E63946;
  border: 3px solid #000;
  color: #FFF;
  text-transform: uppercase;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.1s;
  box-shadow: 4px 4px 0px 0px #000;
  display: inline-block;
  text-decoration: none;
}

.pixel-button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px 0px #000;
  background: #D62839;
}

.pixel-button:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0px 0px #000;
}

.pixel-button.active {
  background: #A4161A;
  box-shadow: inset 3px 3px 0px 0px rgba(0,0,0,0.5);
  transform: translate(2px, 2px);
}

.pixel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============================================
   FORM ELEMENTS
   ============================================ */

.pixel-checkbox input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 3px solid #000;
  background: #F1FAEE;
  position: relative;
  cursor: pointer;
  transition: all 0.1s;
}

.pixel-checkbox input[type="checkbox"]:hover {
  background: #fff;
}

.pixel-checkbox input[type="checkbox"]:checked {
  background: #E63946;
}

.pixel-checkbox input[type="checkbox"]:checked::before {
  content: '✕';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  font-weight: bold;
  color: #FFF;
}

.retro-select {
  font-family: 'VT323', monospace;
  font-size: 20px;
  padding: 8px 16px;
  border: 3px solid #000;
  background: #F1FAEE;
  color: #000;
  cursor: pointer;
  box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.3);
}

.retro-select:focus {
  outline: none;
  box-shadow: 
    0 0 0 2px #E63946,
    4px 4px 0px 0px rgba(0,0,0,0.3);
}

/* ============================================
   BADGES & INDICATORS
   ============================================ */

.pixel-badge {
  font-family: 'Press Start 2P', cursive;
  font-size: 10px;
  padding: 6px 12px;
  border: 2px solid #000;
  display: inline-flex;
  align-items: center;
  text-transform: uppercase;
}

.pixel-badge.live {
  background: #E63946;
  color: #FFF;
  animation: pulse-slow 2s infinite;
}

.pixel-badge.scheduled {
  background: #FFD60A;
  color: #000;
}

.pixel-badge.final {
  background: #457B9D;
  color: #FFF;
}

.live-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  background: #FFF;
  border: 2px solid #000;
  animation: blink 1s steps(2) infinite;
}

/* ============================================
   ODDS DISPLAY
   ============================================ */

.odds-positive {
  color: #2A9D8F;
  font-weight: bold;
}

.odds-negative {
  color: #E76F51;
  font-weight: bold;
}

.odds-display {
  font-family: 'VT323', monospace;
  font-size: 1.5rem;
  font-weight: bold;
}

/* ============================================
   LOADING SPINNERS
   ============================================ */

.pixel-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #E63946;
  border-top-color: transparent;
  border-radius: 0;
  animation: pixelSpin 0.8s steps(8) infinite;
}

.pixel-spinner-large {
  width: 80px;
  height: 80px;
  border: 6px solid #E63946;
  border-top-color: transparent;
  border-radius: 0;
  animation: pixelSpin 0.8s steps(8) infinite;
}

@keyframes pixelSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ============================================
   LOGO & BRANDING
   ============================================ */

.texas-logo {
  width: 120px;
  height: 120px;
  background: url('/assets/cowboy-dollar.svg') no-repeat center;
  background-size: contain;
  image-rendering: pixelated;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

/* ============================================
   TABLES
   ============================================ */

.retro-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 3px solid #000;
}

.retro-table thead {
  background: #1D3557;
  color: #FFF;
}

.retro-table th {
  padding: 12px;
  border-bottom: 3px solid #000;
  font-family: 'Press Start 2P', cursive;
  font-size: 10px;
  text-transform: uppercase;
}

.retro-table td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.retro-table tbody tr:hover {
  background: #F1FAEE;
}

.retro-table tbody tr:last-child td {
  border-bottom: none;
}

/* ============================================
   RESPONSIVE UTILITIES
   ============================================ */

@media (max-width: 768px) {
  .pixel-text {
    font-size: 0.7rem;
  }

  .pixel-button {
    font-size: 9px;
    padding: 10px 16px;
  }

  .retro-panel {
    box-shadow: 
      3px 3px 0px 0px #E63946,
      6px 6px 0px 0px rgba(0,0,0,0.3);
  }

  .pixel-card {
    box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.3);
  }
}

/* ============================================
   SCROLLBAR
   ============================================ */

::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: #1D3557;
  border: 2px solid #000;
}

::-webkit-scrollbar-thumb {
  background: #E63946;
  border: 2px solid #000;
}

::-webkit-scrollbar-thumb:hover {
  background: #D62839;
}
```

---

## 5. API SUBSCRIPTION & MONETIZATION

### API Key Generation Controller

```javascript
// controllers/subscriptionController.js
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

/**
 * POST /api/subscriptions
 * Create a new API subscription
 */
exports.createSubscription = async (req, res, next) => {
  try {
    const { userId, tier = 'FREE' } = req.body;

    // Check if user already has subscription
    const existing = await prisma.apiSubscription.findUnique({
      where: { userId }
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'User already has an active subscription' 
      });
    }

    // Generate unique API key
    const apiKey = `btk_${crypto.randomBytes(24).toString('hex')}`;

    // Set limits based on tier
    const limits = {
      FREE: 100,
      BASIC: 1000,
      PRO: 10000,
      ENTERPRISE: 100000
    };

    const subscription = await prisma.apiSubscription.create({
      data: {
        userId,
        tier,
        apiKey,
        dailyLimit: limits[tier],
        isActive: true
      }
    });

    res.json({
      id: subscription.id,
      apiKey: subscription.apiKey,
      tier: subscription.tier,
      dailyLimit: subscription.dailyLimit
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/subscriptions/me
 * Get current user's subscription
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const { userId } = req.user; // From auth middleware

    const subscription = await prisma.apiSubscription.findUnique({
      where: { userId },
      include: {
        usageLogs: {
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(subscription);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/subscriptions/regenerate
 * Regenerate API key
 */
exports.regenerateApiKey = async (req, res, next) => {
  try {
    const { userId } = req.user;

    const newApiKey = `btk_${crypto.randomBytes(24).toString('hex')}`;

    const subscription = await prisma.apiSubscription.update({
      where: { userId },
      data: { apiKey: newApiKey }
    });

    res.json({
      apiKey: subscription.apiKey,
      message: 'API key regenerated successfully'
    });
  } catch (error) {
    next(error);
  }
};
```

### API Key Authentication Middleware

```javascript
// middleware/apiKeyAuth.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Validate API key and enforce rate limits
 */
exports.validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Include your API key in the X-API-Key header'
      });
    }

    // Fetch subscription
    const subscription = await prisma.apiSubscription.findUnique({
      where: { apiKey },
      include: { user: true }
    });

    if (!subscription) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!subscription.isActive) {
      return res.status(403).json({ error: 'Subscription inactive' });
    }

    // Check if subscription expired
    if (subscription.expiresAt && new Date() > subscription.expiresAt) {
      return res.status(403).json({ error: 'Subscription expired' });
    }

    // Check daily limit
    const today = new Date().toDateString();
    const lastReset = new Date(subscription.lastResetDate).toDateString();

    if (today !== lastReset) {
      // Reset daily counter
      await prisma.apiSubscription.update({
        where: { id: subscription.id },
        data: {
          callsToday: 1,
          lastResetDate: new Date()
        }
      });
    } else {
      // Check if limit exceeded
      if (subscription.callsToday >= subscription.dailyLimit) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          limit: subscription.dailyLimit,
          resetTime: new Date(new Date().setHours(24,0,0,0))
        });
      }

      // Increment call counter
      await prisma.apiSubscription.update({
        where: { id: subscription.id },
        data: {
          callsToday: { increment: 1 }
        }
      });
    }

    // Log API usage
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      prisma.apiUsageLog.create({
        data: {
          subscriptionId: subscription.id,
          endpoint: req.path,
          method: req.method,
          timestamp: new Date(),
          responseTime,
          statusCode: res.statusCode,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      }).catch(err => console.error('Error logging API usage:', err));
    });

    // Attach subscription to request
    req.subscription = subscription;
    req.apiUser = subscription.user;

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### Public API Routes

```javascript
// routes/api/index.js
const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../../middleware/apiKeyAuth');
const gamesController = require('../../controllers/gamesController');
const oddsController = require('../../controllers/oddsController');

// All routes require API key
router.use(validateApiKey);

// Games endpoints
router.get('/games', gamesController.getFilteredGames);
router.get('/games/:id', gamesController.getGameDetails);
router.get('/games/:id/odds', oddsController.getGameOdds);
router.get('/games/:id/odds-history', gamesController.getOddsHistory);

// Odds endpoints
router.get('/odds/live', oddsController.getLiveOdds);
router.get('/odds/upcoming', oddsController.getUpcomingOdds);

// Stats endpoints
router.get('/stats/team/:teamId', statsController.getTeamStats);
router.get('/stats/player/:playerId', statsController.getPlayerStats);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    user: req.apiUser.email,
    tier: req.subscription.tier,
    callsRemaining: req.subscription.dailyLimit - req.subscription.callsToday
  });
});

module.exports = router;
```

---

## 6. AFFILIATE TRACKING SYSTEM

### Affiliate Service

```javascript
// services/affiliateService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AffiliateService {
  constructor() {
    this.affiliateIds = {
      fanduel: process.env.FANDUEL_AFFILIATE_ID,
      draftkings: process.env.DRAFTKINGS_AFFILIATE_ID,
      betmgm: process.env.BETMGM_AFFILIATE_ID,
      caesars: process.env.CAESARS_AFFILIATE_ID,
      pointsbet: process.env.POINTSBET_AFFILIATE_ID,
    };

    this.baseUrls = {
      fanduel: 'https://www.fanduel.com/sportsbook',
      draftkings: 'https://sportsbook.draftkings.com',
      betmgm: 'https://sports.betmgm.com',
      caesars: 'https://www.williamhill.com/us',
      pointsbet: 'https://pointsbet.com',
    };
  }

  /**
   * Generate affiliate link with tracking
   */
  generateAffiliateLink(sportsbook, gameId, betType) {
    const affiliateId = this.affiliateIds[sportsbook.toLowerCase()];
    const baseUrl = this.baseUrls[sportsbook.toLowerCase()];

    if (!baseUrl || !affiliateId) {
      console.warn(`No affiliate config for ${sportsbook}`);
      return null;
    }

    // Generate unique click ID
    const clickId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build affiliate URL with tracking params
    const params = new URLSearchParams({
      aff: affiliateId,
      game: gameId,
      type: betType,
      source: 'bettrack',
      clickid: clickId
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Track affiliate click
   */
  async trackClick(userId, sportsbook, gameId, betType) {
    try {
      const click = await prisma.affiliateClick.create({
        data: {
          userId: userId || null,
          sportsbook,
          gameId,
          betType,
          timestamp: new Date()
        }
      });

      return click.clickId;
    } catch (error) {
      console.error('Error tracking affiliate click:', error);
      return null;
    }
  }

  /**
   * Record conversion (when user places bet)
   */
  async recordConversion(clickId, value) {
    try {
      await prisma.affiliateClick.update({
        where: { clickId },
        data: {
          converted: true,
          conversionValue: value
        }
      });
    } catch (error) {
      console.error('Error recording conversion:', error);
    }
  }

  /**
   * Get affiliate stats
   */
  async getStats(startDate, endDate) {
    try {
      const clicks = await prisma.affiliateClick.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const stats = {
        totalClicks: clicks.length,
        conversions: clicks.filter(c => c.converted).length,
        revenue: clicks.reduce((sum, c) => sum + (c.conversionValue || 0), 0),
        bySportsbook: {}
      };

      // Group by sportsbook
      clicks.forEach(click => {
        if (!stats.bySportsbook[click.sportsbook]) {
          stats.bySportsbook[click.sportsbook] = {
            clicks: 0,
            conversions: 0,
            revenue: 0
          };
        }
        stats.bySportsbook[click.sportsbook].clicks++;
        if (click.converted) {
          stats.bySportsbook[click.sportsbook].conversions++;
          stats.bySportsbook[click.sportsbook].revenue += click.conversionValue || 0;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting affiliate stats:', error);
      return null;
    }
  }
}

module.exports = new AffiliateService();
```

### Affiliate Tracking Controller

```javascript
// controllers/affiliateController.js
const affiliateService = require('../services/affiliateService');

/**
 * POST /api/affiliate/track
 * Track affiliate click
 */
exports.trackClick = async (req, res) => {
  try {
    const { sportsbook, gameId, betType } = req.body;
    const userId = req.user?.id; // Optional - from auth if user logged in

    const clickId = await affiliateService.trackClick(
      userId,
      sportsbook,
      gameId,
      betType
    );

    res.json({ 
      success: true,
      clickId 
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
};

/**
 * POST /api/affiliate/conversion
 * Record conversion (webhook from sportsbook)
 */
exports.recordConversion = async (req, res) => {
  try {
    const { clickId, value } = req.body;

    await affiliateService.recordConversion(clickId, value);

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording conversion:', error);
    res.status(500).json({ error: 'Failed to record conversion' });
  }
};

/**
 * GET /api/affiliate/stats
 * Get affiliate statistics
 */
exports.getStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await affiliateService.getStats(
      new Date(startDate),
      new Date(endDate)
    );

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};
```

---

## 7. DEVELOPMENT & DEPLOYMENT

### Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bettrack"

# Redis Cache
REDIS_URL="redis://localhost:6379"

# External APIs
ODDS_API_KEY="89e116e71bcc7fdd41729e353dc12bcb"
API_SPORTS_KEY="7d67785395f5fbd634f1f7b57974018f"

# Affiliate IDs
FANDUEL_AFFILIATE_ID="your_fanduel_id"
DRAFTKINGS_AFFILIATE_ID="your_draftkings_id"
BETMGM_AFFILIATE_ID="your_betmgm_id"
CAESARS_AFFILIATE_ID="your_caesars_id"

# JWT & Auth
JWT_SECRET="your_super_secret_jwt_key_change_this"
JWT_EXPIRES_IN="7d"

# Server
NODE_ENV="development"
PORT=5000
CLIENT_URL="http://localhost:5173"

# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### Package.json Scripts

```json
{
  "name": "bettrack-sports-hub",
  "version": "2.0.0",
  "description": "Comprehensive sports statistics and betting platform",
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\"",
    "server:dev": "nodemon server/index.js",
    "client:dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "node prisma/seed.js",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset --force",
    "start": "node server/index.js"
  },
  "dependencies": {
    "@prisma/client": "^5.8.0",
    "@reduxjs/toolkit": "^2.0.1",
    "axios": "^1.6.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^9.0.4",
    "react-router-dom": "^6.21.1",
    "redis": "^4.6.12"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "concurrently": "^8.2.2",
    "nodemon": "^3.0.2",
    "postcss": "^8.4.33",
    "prisma": "^5.8.0",
    "tailwindcss": "^3.4.1",
    "vite": "^5.0.10"
  }
}
```

### Docker Compose (Optional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: bettrack
      POSTGRES_PASSWORD: bettrack
      POSTGRES_DB: bettrack
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- ✅ Database schema design & migration
- ✅ Backend API structure
- ✅ External API integration (Odds API, Sports API)
- ✅ Redis caching layer
- ✅ Background jobs for odds sync

### Phase 2: Frontend Core (Weeks 3-4)
- ✅ Visual redesign (retro 8-bit theme)
- ✅ Game filtering UI
- ✅ Lazy loading implementation
- ✅ Responsive design

### Phase 3: Game Details (Weeks 5-7)
- ✅ New game detail layout
- ✅ Team statistics panels
- ✅ Odds comparison table
- ✅ Player statistics
- ✅ Odds history chart

### Phase 4: Betting Features (Weeks 8-9)
- ✅ Multi-sportsbook odds display
- ✅ Affiliate link integration
- ✅ Click tracking system
- ✅ "Bet Now" buttons

### Phase 5: API & Monetization (Weeks 10-12)
- ✅ API subscription system
- ✅ API key generation
- ✅ Rate limiting
- ✅ Usage analytics
- ⏳ Stripe payment integration

### Phase 6: Advanced Features (Weeks 13-16)
- ⏳ AI insights integration
- ⏳ MCP gateway connection
- ⏳ User bet tracking
- ⏳ Portfolio analytics
- ⏳ Push notifications

### Phase 7: Polish & Launch (Weeks 17-20)
- ⏳ Performance optimization
- ⏳ SEO optimization
- ⏳ Analytics integration
- ⏳ Documentation
- ⏳ Beta testing
- ⏳ Production deployment

---

## 9. ADDITIONAL NOTES

### Historic Data Preservation
- **Odds History**: Every odds update is automatically archived to `OddsHistory` table
- **Game Snapshots**: Games are uniquely identified by `externalId + startTime` to handle rescheduling
- **Stats Versioning**: Team and player stats include timestamps for tracking changes
- **No Overwriting**: All historical data is append-only, never deleted

### API Rate Limit Strategy
- The Odds API has usage limits - monitor via dashboard
- Cache aggressively (5-minute TTL for odds)
- Use Redis to reduce database load
- Implement smart polling (only fetch for live games)

### Scaling Considerations
- PostgreSQL connection pooling (Prisma handles this)
- Redis for session storage and caching
- Consider CDN for static assets
- Database indexes on frequently queried fields
- Archive old data to separate tables

### Security Best Practices
- Never expose API keys in client code
- Use HTTPS in production
- Implement CORS properly
- Rate limit all public endpoints
- Sanitize user inputs
- Use parameterized queries (Prisma does this)

---

## Next Steps

1. **Database Setup**: Run migrations and seed data
2. **API Integration**: Test Odds API and Sports API connections
3. **Frontend Prototype**: Build landing page with retro theme
4. **Core Features**: Implement game filtering and detail pages
5. **Affiliate Setup**: Register for sportsbook affiliate programs
6. **API Documentation**: Create API docs for external users
7. **Testing**: Write tests for critical paths
8. **Deployment**: Set up staging and production environments

---

*Last Updated: January 28, 2026*