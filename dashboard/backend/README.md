# Backend README

Node.js + Express + TypeScript + Prisma backend for the Sports Betting Dashboard.

## Features

- **RESTful API** - Bets, games, futures, odds endpoints
- **Prisma ORM** - Type-safe database access with PostgreSQL
- **Scheduled Jobs** - Automatic odds sync and bet settlement (node-cron)
- **Background Processing** - Non-blocking admin operations
- **Timezone Handling** - Accurate game filtering across timezones
- **Validation** - Zod schemas for request validation
- **Parlay Boosts** - Support for profit-based odds boosting

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

3. Set up database:
```bash
npm run prisma:migrate
npm run prisma:generate
```

## Development

```bash
# Start development server with hot reload
npm run dev
```

Server runs on http://localhost:3001

## Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create new migration
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Deploy migrations (production)
npm run prisma:deploy
```

## Project Structure

```
src/
├── config/         # Configuration (env, database, logger)
├── controllers/    # Request handlers
├── services/       # Business logic
├── routes/         # API routes
├── middleware/     # Express middleware
├── utils/          # Utility functions
├── jobs/           # Scheduled tasks
└── types/          # TypeScript types
```

## Arbitrage Detection

Arbitrage and middle opportunities are computed from the `CurrentOdds` snapshot,
which refreshes on `ODDS_SYNC_INTERVAL` (~10 minutes by default).

**Sync-cadence decision:** the sync cadence is deliberately unchanged, because
The Odds API bills per request. Instead of paying for fresher data, every
opportunity carries `oddsSnapshotAge` in seconds, measured from the oldest leg,
and the UI shows that age on every card. Scans are triggered by the
`odds-sync:completed` event so an opportunity surfaces within one cycle of the
data arriving; the cron pass handles expiry and missed syncs. Full rationale and
the criteria for revisiting it are in `docs/internal/adr-019-arbitrage-sync-cadence.md`.

| Variable | Default | Purpose |
|---|---|---|
| `ARBITRAGE_SCAN_ENABLED` | `true` | Kill switch for the feature |
| `ARBITRAGE_SCAN_CRON` | `*/30 * * * * *` | Safety cron and expiry cadence |
| `ARBITRAGE_MIN_PROFIT_PCT` | `0.5` | Floor below which an arb is not persisted |
| `ARBITRAGE_DEFAULT_STAKE` | `1000` | Stake used when sizing legs for display |
| `ARBITRAGE_TTL_SECONDS` | `600` | Opportunity lifetime, one sync cycle |
| `ARBITRAGE_MIN_MIDDLE_PROBABILITY` | `0.10` | Minimum modelled hit rate for a middle |

## Building

```bash
npm run build
npm start
```
