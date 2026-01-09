# Sports Betting Dashboard

A full-stack sports betting tracker that integrates with The Odds API and ESPN API for real-time odds and automatic bet settlement.

## Features

- 🎯 **Real-time Odds** - Sync odds from The Odds API every 10 minutes
- 🎲 **Bet Management** - Create single bets, parlays, and teasers
- 📊 **Analytics** - Track performance with charts and statistics
- ⚡ **Auto Settlement** - Automatic bet settlement using ESPN scores
- 🤖 **MCP Integration** - Claude Desktop integration for AI-powered betting advice
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL 15+ with Prisma ORM
- **APIs**: The Odds API, ESPN API
- **Scheduling**: node-cron for automated jobs

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State**: Redux Toolkit
- **Charts**: Recharts
- **Routing**: React Router

## Prerequisites

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

## Documentation

See the [technical specification](../docs/internal/future-build.md) for full architecture details.
