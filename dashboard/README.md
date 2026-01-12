<div align="center">
  <img src="frontend\public\BetTrackDashboard.png" alt="BetTrack Logo" width="600"/>
  
# BetTrack - Sports Betting Dashboard

**A comprehensive full-stack sports betting tracker with real-time odds, futures betting, SGP support, and automatic bet settlement**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

</div>

---

## ✨ Features

### 🎯 Betting Features
- **Multiple Bet Types** - Singles, Parlays, Teasers (6pt, 6.5pt, 7pt)
- **Same Game Parlays (SGP)** - Combine multiple bets from the same game
- **Futures Betting** - Super Bowl, NBA Championship, World Series, and more
- **Player Props** - 70+ markets (points, assists, rebounds, touchdowns, etc.)
- **Live Odds** - Real-time odds from 5+ bookmakers (DraftKings, FanDuel, BetMGM, etc.)
- **Bet Slip** - Global bet slip accessible across all pages
- **Odds Adjustment** - Manually adjust odds and lines before placing bets

### 📊 Analytics & Tracking
- **Performance Dashboard** - Win/loss tracking with visual charts
- **ROI Analysis** - Calculate return on investment across all bets
- **Sport-Specific Stats** - Breakdown by sport, bet type, and bookmaker
- **Bet History** - Complete history with filters and search
- **Line Movement** - Historical odds tracking with snapshots

### ⚡ Automation
- **Auto Settlement** - Automatic bet resolution using ESPN scores
- **Scheduled Jobs** - Odds sync (every 10 minutes), outcome resolution (every hour)
- **Background Processing** - Non-blocking API operations
- **Timezone-Aware** - Handles multiple timezones for accurate game filtering

### 🤖 AI Integration
- **MCP Server** - Claude Desktop integration for AI-powered betting advice
- **Natural Language Queries** - Ask Claude about odds, games, and betting strategies
- **Smart Search** - Fuzzy matching for team names and matchups

## 🏗️ Tech Stack

### 🔧 Backend
- **Runtime** - Node.js 20-alpine (Docker)
- **Language** - TypeScript 5.7.3 with strict mode
- **Framework** - Express.js REST API
- **Database** - PostgreSQL 16-alpine with Prisma ORM 5.22.0
- **Scheduling** - node-cron for background jobs
- **API Integration** - The Odds API, ESPN API
- **Architecture** - Service-oriented with background workers

### 🎨 Frontend
- **Framework** - React 18.3.1 with TypeScript
- **Build Tool** - Vite 6.4.1 (fast HMR, optimized builds)
- **State Management** - Redux Toolkit with persistent storage
- **Routing** - React Router v6 with nested routes
- **Styling** - Tailwind CSS 3+ with dark mode support
- **Charts** - Recharts for performance visualization
- **Design** - Responsive, mobile-first, purple theme for futures

## 📋 Prerequisites

- Node.js 20+ and npm
- PostgreSQL 15+
- The Odds API key (free tier available at https://the-odds-api.com)

# Configure your database URL in backend/.env
# Configure your API keys in backend/.env
```

### Development

```bash
# Start both backend and frontend in dev mode
npm run dev

# Or start individually
npm run dev:backend
npm run dev:frontend
```

### Build

```bash
# Build both applications
npm run build

# Or build individually
npm run build:backend
npm run build:frontend
```

## Services

- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173
- **Database**: PostgreSQL on localhost:5432

## Production Deployment

### Docker with Secrets (Recommended)

The production Docker images support secure secret management using Docker secrets:

```bash
# 1. Setup secrets directory
mkdir -p secrets
echo -n "your_odds_api_key" > secrets/odds_api_key.txt
echo -n "$(openssl rand -hex 32)" > secrets/session_secret.txt
echo -n "sports_user" > secrets/db_user.txt
echo -n "secure_password" > secrets/db_password.txt

# 2. Secure the files
chmod 600 secrets/*.txt

# 3. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

The backend automatically:
- Loads secrets from `/run/secrets/*` (Docker secrets mount)
- Falls back to `.env` file if present
- Supports environment variables
- Runs database migrations if `AUTO_MIGRATE=true`

**Secret Priority**: Docker secrets > Environment variables > .env file

### Alternative: Environment Variables

For development or simple deployments:

```bash
export DATABASE_URL="postgresql://user:pass@localhost/db"
export ODDS_API_KEY="your_api_key"
export SESSION_SECRET="$(openssl rand -hex 32)"

docker-compose up
```

### External Secret Stores

For production, use managed secret services:
- **AWS**: Secrets Manager or Parameter Store
- **Azure**: Key Vault with managed identities
- **Kubernetes**: Native secrets with RBAC

See [secrets/README.md](secrets/README.md) for complete setup instructions and external store integration.

## Documentation

See the [technical specification](../docs/internal/future-build.md) for full architecture details.
