# Database Guide

Complete guide to the BetTrack database schema, migrations, and data model.

## Table of Contents

- [Database Overview](#database-overview)
- [Schema Design](#schema-design)
- [Core Models](#core-models)
- [Relationships](#relationships)
- [Indexes & Performance](#indexes--performance)
- [Migrations](#migrations)
- [Seeding Data](#seeding-data)
- [Queries & Examples](#queries--examples)
- [Backup & Recovery](#backup--recovery)

---

## Database Overview

BetTrack uses **PostgreSQL** as the primary database with **Prisma ORM** for type-safe database access.

### Technology Stack

- **PostgreSQL 15+** - Relational database
- **Prisma 5.x** - ORM and migration tool
- **Connection pooling** - PgBouncer recommended for production

### Key Features

- **Referential integrity** - Foreign key constraints
- **Cascading deletes** - Automatic cleanup
- **Timestamps** - Automatic created/updated tracking
- **Indexes** - Optimized queries on frequently accessed fields
- **UUID primary keys** - Distributed-system friendly

---

## Schema Design

### Entity Relationship Diagram

```
┌─────────┐         ┌──────────┐
│  Sport  │────────<│   Game   │
└─────────┘         └──────────┘
                         │ │
                         │ └──────┐
                    ┌────┘        │
                    │             │
                ┌───▼───┐     ┌───▼───┐
                │  Team │     │  Team │
                │ (Home)│     │ (Away)│
                └───────┘     └───────┘
                    
┌──────────┐
│   Game   │──────────<│  OddSnapshot  │
└──────────┘           └───────────────┘
     │
     │
     ▼
┌──────────┐
│   Bet    │
└──────────┘
```

---

## Core Models

### Sport Model

Represents available sports leagues (NBA, NFL, NHL, etc.).

```prisma
model Sport {
  key       String   @id              // "basketball_nba"
  title     String                    // "NBA"
  group     String                    // "Basketball"
  active    Boolean  @default(true)
  games     Game[]
  
  @@map("sports")
}
```

**Key Points**:
- `key` is the unique identifier from The Odds API
- `active` flag determines if sport is currently in season
- No timestamps needed (relatively static data)

### Team Model

Represents teams across all sports.

```prisma
model Team {
  id          String    @id @default(uuid())
  espnId      String                      // ESPN API team ID
  name        String                      // "Los Angeles Lakers"
  abbr        String                      // "LAL"
  sport       String                      // "basketball_nba"
  logoUrl     String?                     // CDN URL
  homeGames   Game[]    @relation("HomeGames")
  awayGames   Game[]    @relation("AwayGames")
  
  @@unique([name, sport])
  @@index([sport])
  @@map("teams")
}
```

**Key Points**:
- Unique constraint on `(name, sport)` prevents duplicates
- Separate relations for home and away games
- `espnId` links to ESPN API for additional data
- Index on `sport` for fast filtering

### Game Model

Represents individual sporting events.

```prisma
model Game {
  id           String      @id @default(uuid())
  externalId   String      @unique         // Odds API event_id
  sport        String
  sportKey     String                      // Denormalized for convenience
  sportName    String                      // Denormalized for convenience
  homeTeamId   String
  awayTeamId   String
  homeTeam     Team        @relation("HomeGames", fields: [homeTeamId], references: [id], onDelete: Cascade)
  awayTeam     Team        @relation("AwayGames", fields: [awayTeamId], references: [id], onDelete: Cascade)
  commenceTime DateTime
  completed    Boolean     @default(false)
  homeScore    Int?
  awayScore    Int?
  bets         Bet[]
  oddSnapshots OddSnapshot[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  
  @@index([sport])
  @@index([commenceTime])
  @@index([completed])
  @@map("games")
}
```

**Key Points**:
- `externalId` is unique identifier from The Odds API
- Denormalized `sportKey` and `sportName` for easier frontend consumption
- Multiple indexes for common query patterns
- Cascading delete removes related bets when game deleted
- `commenceTime` indexed for date-range queries

### OddSnapshot Model

Tracks historical odds for line movement analysis.

```prisma
model OddSnapshot {
  id          String   @id @default(uuid())
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  bookmaker   String                       // "draftkings"
  marketType  String                       // "h2h", "spreads", "totals"
  team        String?                      // Team name (for moneyline/spreads)
  player      String?                      // Player name (for props)
  propType    String?                      // "player_points", "player_rebounds"
  price       Float                        // American odds (-150, +130)
  point       Float?                       // Spread/total line (7.5, 220.5)
  timestamp   DateTime @default(now())
  
  @@index([gameId])
  @@index([bookmaker])
  @@index([timestamp])
  @@map("odd_snapshots")
}
```

**Key Points**:
- Time-series data for charting line movement
- Supports game markets AND player props
- Indexes on `gameId`, `bookmaker`, and `timestamp` for fast queries
- No updates - always insert new snapshots

### Bet Model

User bets placed on games.

```prisma
model Bet {
  id          String   @id @default(uuid())
  gameId      String
  game        Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  betType     String                       // "moneyline", "spread", "total", "player_prop"
  odds        Float                        // Odds at time of bet placement
  stake       Float                        // Amount wagered
  team        String?                      // For team-based bets
  player      String?                      // For player props
  propType    String?                      // "player_points", etc.
  point       Float?                       // Spread/total line
  status      String   @default("pending") // "pending", "won", "lost", "push"
  payout      Float?                       // Calculated payout (null until settled)
  placedAt    DateTime @default(now())
  settledAt   DateTime?
  
  @@index([gameId])
  @@index([status])
  @@index([placedAt])
  @@map("bets")
}
```

**Key Points**:
- Stores odds at placement time (immutable)
- Status tracks bet lifecycle
- `settledAt` timestamp for outcome resolution
- Indexes on `status` and `placedAt` for filtering

---

## Relationships

### One-to-Many Relationships

```prisma
// Sport has many Games
model Sport {
  key   String @id
  games Game[]
}

model Game {
  sport    String
  sportKey String
  // No explicit relation field needed for simple filtering
}
```

### Many-to-One Relationships

```prisma
// Game belongs to Home Team and Away Team
model Game {
  homeTeamId String
  awayTeamId String
  homeTeam   Team @relation("HomeGames", fields: [homeTeamId], references: [id])
  awayTeam   Team @relation("AwayGames", fields: [awayTeamId], references: [id])
}

model Team {
  id        String @id @default(uuid())
  homeGames Game[] @relation("HomeGames")
  awayGames Game[] @relation("AwayGames")
}
```

**Named relations required** when model has multiple relations to same target.

### Cascading Deletes

```prisma
model Game {
  id   String @id
  bets Bet[]
}

model Bet {
  gameId String
  game   Game @relation(fields: [gameId], references: [id], onDelete: Cascade)
}
```

When a `Game` is deleted, all related `Bet` records are automatically deleted.

---

## Indexes & Performance

### Primary Indexes

```prisma
model Game {
  id           String   @id @default(uuid())     // Clustered index
  externalId   String   @unique                  // Unique index
  
  @@index([sport])                               // Non-clustered index
  @@index([commenceTime])
  @@index([completed])
}
```

### Composite Indexes

```prisma
model Team {
  name  String
  sport String
  
  @@unique([name, sport])  // Composite unique constraint
}
```

### Query Optimization Examples

**Bad** (no index):
```typescript
// Slow: scans all games
const games = await prisma.game.findMany({
  where: { completed: false },
});
```

**Good** (uses index):
```prisma
model Game {
  completed Boolean
  @@index([completed])  // Index added
}
```

**Best** (composite index):
```prisma
model Game {
  sport     String
  completed Boolean
  @@index([sport, completed])  // Composite index
}
```

```typescript
// Fast: uses composite index
const games = await prisma.game.findMany({
  where: {
    sport: 'basketball_nba',
    completed: false,
  },
});
```

---

## Migrations

### Creating Migrations

```bash
# Create new migration after schema changes
npm run prisma:migrate -- --name add_player_props

# Apply pending migrations
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npm run prisma:migrate reset
```

### Migration Files

Stored in `prisma/migrations/`:

```
prisma/migrations/
├── 20260101000000_init/
│   └── migration.sql
├── 20260102000000_add_odds_snapshots/
│   └── migration.sql
└── migration_lock.toml
```

### Example Migration

**File**: `prisma/migrations/20260102000000_add_odds_snapshots/migration.sql`

```sql
-- CreateTable
CREATE TABLE "odd_snapshots" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "point" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odd_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odd_snapshots_gameId_idx" ON "odd_snapshots"("gameId");

-- AddForeignKey
ALTER TABLE "odd_snapshots" ADD CONSTRAINT "odd_snapshots_gameId_fkey" 
  FOREIGN KEY ("gameId") REFERENCES "games"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## Seeding Data

### Seed Script

**File**: `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Seed sports
  const sports = [
    { key: 'basketball_nba', title: 'NBA', group: 'Basketball', active: true },
    { key: 'americanfootball_nfl', title: 'NFL', group: 'American Football', active: true },
    { key: 'icehockey_nhl', title: 'NHL', group: 'Ice Hockey', active: true },
    { key: 'baseball_mlb', title: 'MLB', group: 'Baseball', active: false },
  ];
  
  for (const sport of sports) {
    await prisma.sport.upsert({
      where: { key: sport.key },
      update: sport,
      create: sport,
    });
  }
  
  console.log('Seeded sports:', sports.length);
  
  // Seed teams (example)
  const teams = [
    {
      espnId: '13',
      name: 'Los Angeles Lakers',
      abbr: 'LAL',
      sport: 'basketball_nba',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    },
    // ... more teams
  ];
  
  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        name_sport: {
          name: team.name,
          sport: team.sport,
        },
      },
      update: team,
      create: team,
    });
  }
  
  console.log('Seeded teams:', teams.length);
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

### Running Seeds

```bash
# Run seed script
npm run prisma:seed

# Or with migration reset
npm run prisma:migrate reset
```

---

## Queries & Examples

### Basic Queries

```typescript
// Find all NBA games today
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const games = await prisma.game.findMany({
  where: {
    sport: 'basketball_nba',
    commenceTime: {
      gte: today,
      lt: tomorrow,
    },
  },
  include: {
    homeTeam: true,
    awayTeam: true,
  },
  orderBy: {
    commenceTime: 'asc',
  },
});
```

### Aggregations

```typescript
// Count bets by status
const betStats = await prisma.bet.groupBy({
  by: ['status'],
  _count: true,
  _sum: {
    stake: true,
    payout: true,
  },
});

// Output:
// [
//   { status: 'pending', _count: 15, _sum: { stake: 150, payout: null } },
//   { status: 'won', _count: 8, _sum: { stake: 80, payout: 176 } },
//   { status: 'lost', _count: 7, _sum: { stake: 70, payout: 0 } },
// ]
```

### Complex Queries

```typescript
// Get games with latest odds for each bookmaker
const gamesWithOdds = await prisma.game.findMany({
  where: {
    commenceTime: { gte: new Date() },
  },
  include: {
    homeTeam: true,
    awayTeam: true,
    oddSnapshots: {
      where: {
        marketType: 'h2h',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 5, // Latest 5 bookmakers
      distinct: ['bookmaker'],
    },
  },
});
```

### Transactions

```typescript
// Place bet and update game stats atomically
await prisma.$transaction(async (tx) => {
  const bet = await tx.bet.create({
    data: {
      gameId: gameId,
      betType: 'moneyline',
      odds: -150,
      stake: 100,
      team: 'Lakers',
    },
  });
  
  await tx.game.update({
    where: { id: gameId },
    data: {
      betCount: { increment: 1 },
    },
  });
  
  return bet;
});
```

### Raw SQL

```typescript
// Complex query not expressible in Prisma
const results = await prisma.$queryRaw`
  SELECT 
    g."sport",
    COUNT(*) as game_count,
    AVG(b."stake") as avg_stake
  FROM games g
  LEFT JOIN bets b ON b."gameId" = g.id
  WHERE g."commenceTime" >= NOW()
  GROUP BY g."sport"
  ORDER BY game_count DESC
`;
```

---

## Backup & Recovery

### Automated Backups

```bash
# Daily backup with timestamp
pg_dump -h localhost -U postgres bettrack > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U postgres bettrack | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
# Restore SQL backup
psql -h localhost -U postgres bettrack < backup_20260112.sql

# Restore compressed backup
gunzip -c backup_20260112.sql.gz | psql -h localhost -U postgres bettrack
```

### Docker Backup

```bash
# Backup from Docker container
docker exec -t bettrack_db pg_dump -U postgres bettrack > backup.sql

# Restore to Docker container
cat backup.sql | docker exec -i bettrack_db psql -U postgres bettrack
```

---

## Performance Tips

### 1. Use Indexes

Index frequently queried fields:
```prisma
@@index([sport])
@@index([commenceTime])
@@index([completed])
```

### 2. Limit Result Sets

Always use `take` or `pagination`:
```typescript
const games = await prisma.game.findMany({
  take: 50,
  skip: (page - 1) * 50,
});
```

### 3. Select Only Needed Fields

```typescript
// Bad: fetches all fields
const teams = await prisma.team.findMany();

// Good: selective fields
const teams = await prisma.team.findMany({
  select: {
    id: true,
    name: true,
    abbr: true,
  },
});
```

### 4. Use Connection Pooling

**PgBouncer** recommended for production:
```
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/bettrack?pgbouncer=true"
```

### 5. Batch Operations

```typescript
// Bad: N queries
for (const bet of bets) {
  await prisma.bet.create({ data: bet });
}

// Good: 1 query
await prisma.bet.createMany({ data: bets });
```

---

## Database Maintenance

### Analyze & Vacuum

```sql
-- Update table statistics
ANALYZE games;

-- Reclaim storage
VACUUM FULL games;
```

### Check Indexes

```sql
-- List unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;
```

### Monitor Performance

```sql
-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Next Steps

- [Backend API Guide](Backend-Guide)
- [Frontend Guide](Frontend-Guide)
- [MCP Server Guide](MCP-Server-Guide)
- [Quick Start](Quick-Start)
