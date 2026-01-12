# Backend Guide

Complete guide to the BetTrack dashboard backend - Node.js, TypeScript, Prisma, and API architecture.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Services](#services)
- [Scheduled Jobs](#scheduled-jobs)
- [Database Integration](#database-integration)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Architecture Overview

The BetTrack backend is a RESTful API server built with Node.js, Express, TypeScript, and Prisma ORM.

### Key Features

- 🚀 **Express.js** for HTTP routing
- 📘 **TypeScript** for type safety
- 🗄️ **Prisma ORM** for database access
- ⏰ **node-cron** for scheduled jobs
- 🔒 **Helmet** for security headers
- 📊 **Winston** for logging
- ✅ **Jest** for testing

### Architecture Principles

1. **Service Layer Pattern**: Business logic in services, not routes
2. **Background Jobs**: Long-running tasks execute asynchronously
3. **Timezone Awareness**: All date filtering respects client timezone
4. **Error Handling**: Centralized error middleware
5. **Validation**: Request validation at route level

---

## Technology Stack

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "typescript": "^5.3.3",
    "@prisma/client": "^5.8.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "prisma": "^5.8.0",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.6"
  }
}
```

---

## Project Structure

```
dashboard/backend/
├── src/
│   ├── routes/                  # Express route handlers
│   │   ├── games.routes.ts      # Game endpoints
│   │   ├── bets.routes.ts       # Bet management
│   │   ├── odds.routes.ts       # Odds data
│   │   ├── admin.routes.ts      # Admin utilities
│   │   └── mcp.routes.ts        # MCP integration
│   ├── services/                # Business logic
│   │   ├── odds-sync.service.ts # Background odds syncing
│   │   ├── bet.service.ts       # Bet operations
│   │   ├── outcome.service.ts   # Bet settlement
│   │   └── game.service.ts      # Game queries
│   ├── jobs/                    # Scheduled cron jobs
│   │   ├── odds-sync.job.ts     # Auto sync odds
│   │   └── outcome-resolver.job.ts # Auto settle bets
│   ├── middleware/              # Express middleware
│   │   ├── error.middleware.ts  # Error handler
│   │   ├── logger.middleware.ts # Request logging
│   │   └── validate.middleware.ts # Input validation
│   ├── utils/                   # Utility functions
│   │   ├── timezone.utils.ts    # Timezone conversions
│   │   ├── odds.utils.ts        # Odds calculations
│   │   └── logger.ts            # Winston logger
│   ├── types/                   # TypeScript types
│   │   ├── game.types.ts        # Game interfaces
│   │   └── bet.types.ts         # Bet interfaces
│   ├── app.ts                   # Express app setup
│   └── server.ts                # Server entry point
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Database migrations
│   └── seed.ts                 # Seed data
├── tests/                      # Test files
├── logs/                       # Application logs
├── .env                        # Environment variables
├── tsconfig.json              # TypeScript config
└── package.json
```

---

## API Routes

### Games Routes

**File**: `src/routes/games.routes.ts`

```typescript
import { Router } from 'express';
import { GameService } from '../services/game.service';

const router = Router();
const gameService = new GameService();

/**
 * GET /api/games
 * Fetch games with timezone-aware date filtering
 * 
 * Query params:
 * - sport: Sport key (optional)
 * - date: YYYY-MM-DD (optional, defaults to today)
 * - timezoneOffset: Minutes from UTC (required for accurate filtering)
 */
router.get('/', async (req, res, next) => {
  try {
    const { sport, date, timezoneOffset } = req.query;
    
    // Convert date to UTC range based on user's timezone
    const { startOfDayUTC, endOfDayUTC } = convertToUTCRange(
      date as string,
      parseInt(timezoneOffset as string)
    );
    
    const games = await gameService.findGames({
      sport: sport as string,
      startDate: startOfDayUTC,
      endDate: endOfDayUTC,
    });
    
    res.json(games);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/games/:id
 * Get single game with full details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const game = await gameService.findGameById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Bets Routes

**File**: `src/routes/bets.routes.ts`

```typescript
import { Router } from 'express';
import { BetService } from '../services/bet.service';

const router = Router();
const betService = new BetService();

/**
 * POST /api/bets
 * Create new bet(s)
 * 
 * Body: { bets: Array<BetInput> }
 */
router.post('/', async (req, res, next) => {
  try {
    const { bets } = req.body;
    
    // Validate bet data
    for (const bet of bets) {
      if (!bet.gameId || !bet.betType || !bet.odds || !bet.stake) {
        return res.status(400).json({ error: 'Missing required bet fields' });
      }
    }
    
    const createdBets = await betService.createBets(bets);
    res.status(201).json(createdBets);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bets
 * List user's bets with filters
 * 
 * Query params:
 * - status: pending|won|lost (optional)
 * - limit: Number of results (default: 50)
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '50' } = req.query;
    
    const bets = await betService.findBets({
      status: status as string,
      limit: parseInt(limit as string),
    });
    
    res.json(bets);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bets/stats
 * Get betting statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await betService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Admin Routes

**File**: `src/routes/admin.routes.ts`

```typescript
import { Router } from 'express';
import { OddsSyncService } from '../services/odds-sync.service';
import { OutcomeService } from '../services/outcome.service';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const oddsSyncService = new OddsSyncService();
const outcomeService = new OutcomeService();

/**
 * POST /api/admin/init-sports
 * Initialize sports in database
 */
router.post('/init-sports', async (req, res, next) => {
  try {
    const sports = [
      { key: 'basketball_nba', title: 'NBA', group: 'Basketball', active: true },
      { key: 'americanfootball_nfl', title: 'NFL', group: 'American Football', active: true },
      { key: 'basketball_ncaab', title: 'NCAAB', group: 'Basketball', active: true },
      { key: 'icehockey_nhl', title: 'NHL', group: 'Ice Hockey', active: true },
      { key: 'baseball_mlb', title: 'MLB', group: 'Baseball', active: true },
      { key: 'soccer_epl', title: 'EPL', group: 'Soccer', active: true },
      { key: 'soccer_uefa_champs_league', title: 'UEFA Champions', group: 'Soccer', active: true },
    ];
    
    await prisma.sport.createMany({
      data: sports,
      skipDuplicates: true,
    });
    
    res.json({ success: true, count: sports.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/sync-odds
 * Manually trigger odds sync (background job)
 * 
 * Body: { sportKey?: string } - Optional sport filter
 */
router.post('/sync-odds', async (req, res, next) => {
  try {
    const { sportKey } = req.body;
    
    // Run in background - don't wait for completion
    oddsSyncService.syncOdds(sportKey).catch(err => {
      console.error('Background odds sync failed:', err);
    });
    
    res.json({
      success: true,
      message: 'Odds sync started in background',
      sportKey: sportKey || 'all',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/resolve-outcomes
 * Manually trigger bet outcome resolution (background job)
 */
router.post('/resolve-outcomes', async (req, res, next) => {
  try {
    // Run in background
    outcomeService.resolveOutcomes().catch(err => {
      console.error('Background outcome resolution failed:', err);
    });
    
    res.json({
      success: true,
      message: 'Outcome resolution started in background',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats
 * Get database statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [gameCount, betCount, sportCount, activeGames] = await Promise.all([
      prisma.game.count(),
      prisma.bet.count(),
      prisma.sport.count(),
      prisma.game.count({ where: { completed: false } }),
    ]);
    
    const recentGames = await prisma.game.findMany({
      take: 5,
      orderBy: { commenceTime: 'desc' },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });
    
    res.json({
      counts: {
        games: gameCount,
        bets: betCount,
        sports: sportCount,
        activeGames,
      },
      recentGames,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/health
 * Detailed health check
 */
router.get('/health', async (req, res, next) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      service: 'bettrack-backend',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'bettrack-backend',
      error: error.message,
    });
  }
});

export default router;
```

---

## Services

### Odds Sync Service

**File**: `src/services/odds-sync.service.ts`

```typescript
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export class OddsSyncService {
  private prisma: PrismaClient;
  private oddsApiKey: string;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.oddsApiKey = process.env.ODDS_API_KEY!;
  }
  
  /**
   * Sync odds from The Odds API for all active sports
   * Runs in background, can take several minutes
   */
  async syncOdds(sportKey?: string): Promise<void> {
    try {
      logger.info(`Starting odds sync${sportKey ? ` for ${sportKey}` : ''}`);
      
      // Get active sports to sync
      const sports = sportKey
        ? await this.prisma.sport.findMany({ where: { key: sportKey } })
        : await this.prisma.sport.findMany({ where: { active: true } });
      
      for (const sport of sports) {
        await this.syncSportOdds(sport.key);
      }
      
      logger.info('Odds sync completed successfully');
    } catch (error) {
      logger.error('Odds sync failed:', error);
      throw error;
    }
  }
  
  /**
   * Sync odds for a single sport
   */
  private async syncSportOdds(sportKey: string): Promise<void> {
    try {
      // Fetch odds from API
      const response = await axios.get(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`,
        {
          params: {
            apiKey: this.oddsApiKey,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
          },
        }
      );
      
      const games = response.data;
      logger.info(`Fetched ${games.length} games for ${sportKey}`);
      
      // Process each game
      for (const game of games) {
        await this.saveGame(game, sportKey);
        await this.saveOdds(game);
      }
      
      // Log remaining requests
      const remaining = response.headers['x-requests-remaining'];
      logger.info(`Requests remaining: ${remaining}`);
    } catch (error) {
      logger.error(`Failed to sync ${sportKey}:`, error);
    }
  }
  
  /**
   * Save or update game in database
   */
  private async saveGame(game: any, sportKey: string): Promise<void> {
    // Upsert game
    await this.prisma.game.upsert({
      where: { externalId: game.id },
      update: {
        commenceTime: new Date(game.commence_time),
        completed: game.completed || false,
      },
      create: {
        externalId: game.id,
        sport: sportKey,
        homeTeamId: await this.getOrCreateTeam(game.home_team, sportKey),
        awayTeamId: await this.getOrCreateTeam(game.away_team, sportKey),
        commenceTime: new Date(game.commence_time),
        completed: false,
      },
    });
  }
  
  /**
   * Save odds snapshots for historical tracking
   */
  private async saveOdds(game: any): Promise<void> {
    const timestamp = new Date();
    
    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          await this.prisma.oddSnapshot.create({
            data: {
              gameId: game.id,
              bookmaker: bookmaker.key,
              marketType: market.key,
              team: outcome.name,
              price: outcome.price,
              point: outcome.point,
              timestamp,
            },
          });
        }
      }
    }
  }
  
  /**
   * Get existing team or create new one
   */
  private async getOrCreateTeam(teamName: string, sport: string): Promise<string> {
    let team = await this.prisma.team.findFirst({
      where: { name: teamName, sport },
    });
    
    if (!team) {
      team = await this.prisma.team.create({
        data: {
          name: teamName,
          sport,
          espnId: '', // TODO: Map to ESPN ID
          abbr: this.getTeamAbbr(teamName),
        },
      });
    }
    
    return team.id;
  }
  
  private getTeamAbbr(teamName: string): string {
    // Simple abbreviation logic
    const words = teamName.split(' ');
    return words.map(w => w[0]).join('').toUpperCase();
  }
}
```

### Bet Service

**File**: `src/services/bet.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface BetInput {
  gameId: string;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop';
  odds: number;
  stake: number;
  team?: string;
  player?: string;
  propType?: string;
}

export class BetService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  /**
   * Create multiple bets in a transaction
   */
  async createBets(bets: BetInput[]): Promise<any[]> {
    try {
      const createdBets = await this.prisma.$transaction(
        bets.map(bet =>
          this.prisma.bet.create({
            data: {
              gameId: bet.gameId,
              betType: bet.betType,
              odds: bet.odds,
              stake: bet.stake,
              team: bet.team,
              player: bet.player,
              propType: bet.propType,
              status: 'pending',
              placedAt: new Date(),
            },
          })
        )
      );
      
      logger.info(`Created ${createdBets.length} bets`);
      return createdBets;
    } catch (error) {
      logger.error('Failed to create bets:', error);
      throw error;
    }
  }
  
  /**
   * Find bets with filters
   */
  async findBets(filters: {
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    const { status, limit = 50 } = filters;
    
    return this.prisma.bet.findMany({
      where: status ? { status } : undefined,
      take: limit,
      orderBy: { placedAt: 'desc' },
      include: {
        game: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    });
  }
  
  /**
   * Get betting statistics
   */
  async getStats(): Promise<any> {
    const [totalBets, totalStaked, totalWon, winRate] = await Promise.all([
      this.prisma.bet.count(),
      this.prisma.bet.aggregate({
        _sum: { stake: true },
      }),
      this.prisma.bet.aggregate({
        where: { status: 'won' },
        _sum: { payout: true },
      }),
      this.prisma.bet.count({ where: { status: 'won' } }),
    ]);
    
    const settledBets = await this.prisma.bet.count({
      where: { status: { in: ['won', 'lost'] } },
    });
    
    return {
      totalBets,
      totalStaked: totalStaked._sum.stake || 0,
      totalWon: totalWon._sum.payout || 0,
      winRate: settledBets > 0 ? (winRate / settledBets) * 100 : 0,
      pendingBets: totalBets - settledBets,
    };
  }
}
```

---

## Scheduled Jobs

### Odds Sync Job

**File**: `src/jobs/odds-sync.job.ts`

```typescript
import cron from 'node-cron';
import { OddsSyncService } from '../services/odds-sync.service';
import { logger } from '../utils/logger';

const oddsSyncService = new OddsSyncService();

/**
 * Scheduled job to sync odds every 5 minutes
 * Runs at: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 minutes
 */
export function startOddsSyncJob(): void {
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running scheduled odds sync');
    try {
      await oddsSyncService.syncOdds();
      logger.info('Scheduled odds sync completed');
    } catch (error) {
      logger.error('Scheduled odds sync failed:', error);
    }
  });
  
  logger.info('Odds sync job scheduled (every 5 minutes)');
}
```

### Outcome Resolver Job

**File**: `src/jobs/outcome-resolver.job.ts`

```typescript
import cron from 'node-cron';
import { OutcomeService } from '../services/outcome.service';
import { logger } from '../utils/logger';

const outcomeService = new OutcomeService();

/**
 * Scheduled job to resolve bet outcomes every hour
 * Runs at: 0 minutes past every hour
 */
export function startOutcomeResolverJob(): void {
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled outcome resolution');
    try {
      await outcomeService.resolveOutcomes();
      logger.info('Scheduled outcome resolution completed');
    } catch (error) {
      logger.error('Scheduled outcome resolution failed:', error);
    }
  });
  
  logger.info('Outcome resolver job scheduled (hourly)');
}
```

---

## Database Integration

### Prisma Client Usage

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  return prisma;
}

// Graceful shutdown
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
```

### Transactions

```typescript
// Multiple operations in a transaction
await prisma.$transaction(async (tx) => {
  const bet = await tx.bet.create({ data: betData });
  await tx.game.update({
    where: { id: gameId },
    data: { betCount: { increment: 1 } },
  });
  return bet;
});
```

---

## Error Handling

### Error Middleware

**File**: `src/middleware/error.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
```

---

## Development

### Local Setup

```bash
# Navigate to backend
cd dashboard/backend

# Install dependencies
npm install

# Setup database
npm run prisma:migrate
npm run prisma:generate

# Start development server
npm run dev

# Server runs on http://localhost:3001
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bettrack"

# API Keys
ODDS_API_KEY="your_odds_api_key"

# Server
PORT=3001
NODE_ENV=development

# Security
SESSION_SECRET="your_secret_key"
```

---

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Next Steps

- [Database Schema Guide](Database-Guide)
- [Frontend Guide](Frontend-Guide)
- [MCP Server Guide](MCP-Server-Guide)
