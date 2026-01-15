# Quick Start Guide

Get BetTrack up and running in minutes! Choose your path based on what you want to use.

## Table of Contents

- [Option 1: MCP Server Only (Recommended for Beginners)](#option-1-mcp-server-only)
- [Option 2: Full Dashboard (Backend + Frontend)](#option-2-full-dashboard)
- [Option 3: Everything (MCP + Dashboard)](#option-3-everything)
- [Verification](#verification)
- [Next Steps](#next-steps)

---

## Option 1: MCP Server Only

**Best for**: Using Claude Desktop to query sports data via natural language

**Time**: 5 minutes

### Step 1: Get an API Key

1. Visit [the-odds-api.com](https://the-odds-api.com)
2. Sign up for free account (500 requests/month)
3. Copy your API key

### Step 2: Download & Install

1. Go to [Releases](https://github.com/yourusername/BetTrack/releases)
2. Download latest `.mcpb` file (e.g., `sports-data-mcp-v0.1.13.mcpb`)
3. Open **Claude Desktop**
4. Go to **Settings** → **Developer**
5. Click **"Install MCP Package"**
6. Select the downloaded `.mcpb` file
7. Wait for "Installation Complete" message

### Step 3: Configure

1. Locate config directory:
   - **Windows**: `%APPDATA%\Claude\sports-mcp-config\`
   - **macOS**: `~/Library/Application Support/Claude/sports-mcp-config/`
   - **Linux**: `~/.config/Claude/sports-mcp-config/`

2. Open `.env` file and add your API key:
   ```bash
   ODDS_API_KEY=your_api_key_here
   ```

3. **Optional**: Add bookmaker filtering:
   ```bash
   BOOKMAKERS_FILTER=draftkings,fanduel,betmgm
   BOOKMAKERS_LIMIT=3
   ```

### Step 4: Restart Claude Desktop

Close and reopen Claude Desktop to load the server.

### Step 5: Test It!

Ask Claude:
```
What NBA games are today and what are the odds?
```

Claude should respond with game information and betting lines!

---

## Option 2: Full Dashboard

**Best for**: Running the web dashboard for bet tracking and line movement charts

**Time**: 15 minutes

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **PostgreSQL 15+** - [Download](https://www.postgresql.org/download/)
- **The Odds API key** - [Get key](https://the-odds-api.com)

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/BetTrack.git
cd BetTrack/dashboard
```

### Step 2: Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
# Required:
#   DATABASE_URL="postgresql://user:password@localhost:5432/bettrack"
#   ODDS_API_KEY="your_api_key"
#   SESSION_SECRET="run: openssl rand -hex 32"
```

**Create Database**:
```bash
# Using psql
psql -U postgres
CREATE DATABASE bettrack;
\q

# Run migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed
```

### Step 3: Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3001/api" > .env
```

### Step 4: Start Services

**Terminal 1** (Backend):
```bash
cd dashboard/backend
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2** (Frontend):
```bash
cd dashboard/frontend
npm run dev
# Runs on http://localhost:5173
```

### Step 5: Initialize Sports

Open browser to [http://localhost:5173](http://localhost:5173)

**Run initialization** (one-time setup):
```bash
# Initialize sports in database
curl -X POST http://localhost:3001/api/admin/init-sports

# Sync initial odds data
curl -X POST http://localhost:3001/api/admin/sync-odds
```

### Step 6: Access Dashboard

Visit [http://localhost:5173](http://localhost:5173)

You should see games with odds from various bookmakers!

---

## Option 3: Everything

**Best for**: Using both MCP Server and Dashboard together

**Time**: 20 minutes

Follow **Option 1** (MCP Server) and **Option 2** (Dashboard) in sequence.

### Additional: MCP Dashboard Integration

The dashboard includes its own MCP server for bet management via Claude Desktop.

**Configure** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "bettrack-sports": {
      "command": "python",
      "args": ["C:/path/to/BetTrack/mcp/sports_mcp_server.py"],
      "env": {
        "ODDS_API_KEY": "your_key"
      }
    },
    "bettrack-dashboard": {
      "command": "python",
      "args": ["C:/path/to/BetTrack/mcp/dashboard_mcp_server.py"],
      "env": {
        "API_URL": "http://localhost:3001/api"
      }
    }
  }
}
```

Now Claude can query both sports data AND manage your bets!

---

## Verification

### MCP Server Health Check

Ask Claude:
```
List the available sports data tools
```

Expected response should include tools like:
- `get_odds`
- `search_odds`
- `get_formatted_scoreboard`
- `get_espn_schedule`

### Dashboard Health Check

**Backend**:
```bash
curl http://localhost:3001/api/admin/health
```

Expected:
```json
{
  "status": "healthy",
  "service": "bettrack-backend",
  "database": "connected"
}
```

**Frontend**:
Open [http://localhost:5173](http://localhost:5173) and verify:
- Games are displayed
- Odds are shown for each game
- No console errors in browser DevTools

### Database Check

```bash
# Check Prisma connection
cd dashboard/backend
npm run prisma:studio
```

Prisma Studio should open in browser showing your database tables.

---

## Common Issues

### Issue: "MCP server not responding"

**Solutions**:
1. Restart Claude Desktop
2. Check `.env` file has valid `ODDS_API_KEY`
3. Verify Python 3.11+ is installed: `python --version`
4. Check logs in config directory

### Issue: "Database connection failed"

**Solutions**:
1. Verify PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
2. Check `DATABASE_URL` in `.env` file
3. Test connection: `npm run prisma:studio`
4. Run migrations: `npm run prisma:migrate`

### Issue: "No games showing in dashboard"

**Solutions**:
1. Initialize sports: `curl -X POST http://localhost:3001/api/admin/init-sports`
2. Sync odds: `curl -X POST http://localhost:3001/api/admin/sync-odds`
3. Check backend logs: `dashboard/backend/logs/app.log`
4. Verify API key has remaining requests

### Issue: "CORS errors in browser"

**Solutions**:
1. Ensure backend is running on port 3001
2. Check `VITE_API_URL` in frontend `.env`
3. Verify CORS is enabled in backend (`cors` middleware)

### Issue: "Rate limit exceeded"

**Solutions**:
1. Check API usage: Visit [the-odds-api.com/account](https://the-odds-api.com/account)
2. Use multiple API keys (round-robin): `ODDS_API_KEY=key1,key2,key3`
3. Increase sync interval in cron jobs
4. Upgrade to paid tier

---

## Docker Quick Start

**Best for**: Production deployment or simplified setup

### Step 1: Install Docker

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- [Docker Engine](https://docs.docker.com/engine/install/) (Linux)

### Step 2: Configure Environment

```bash
cd BetTrack/dashboard

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@postgres:5432/bettrack
ODDS_API_KEY=your_api_key
SESSION_SECRET=$(openssl rand -hex 32)
GITHUB_OWNER=yourusername
VERSION=latest
EOF
```

### Step 3: Start Services

```bash
# Start everything (frontend, backend, database)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Step 4: Initialize

```bash
# Run migrations
docker-compose exec backend npm run prisma:migrate

# Initialize sports
docker-compose exec backend npm run init:sports

# Sync odds
docker-compose exec backend npm run sync:odds
```

### Step 5: Access

- **Frontend**: [http://localhost:80](http://localhost:80)
- **Backend**: [http://localhost:3001](http://localhost:3001)
- **Prisma Studio**: `docker-compose exec backend npm run prisma:studio`

---

## Production Deployment

### Using Pre-built Docker Images

```bash
# Pull images from GitHub Container Registry
docker pull ghcr.io/yourusername/bettrack-backend:latest
docker pull ghcr.io/yourusername/bettrack-frontend:latest

# Run with docker-compose
cd dashboard
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables (Production)

```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/bettrack
ODDS_API_KEY=your_production_key
SESSION_SECRET=secure_random_string_min_32_chars

# Optional
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
```

### Health Monitoring

```bash
# Backend health
curl https://api.yourdomain.com/api/admin/health

# Check database stats
curl https://api.yourdomain.com/api/admin/stats
```

---

## Next Steps

### Learn More

- [MCP Server Guide](MCP-Server-Guide) - Deep dive into MCP tools and architecture
- [Frontend Guide](Frontend-Guide) - React components and state management
- [Backend Guide](Backend-Guide) - API routes and services
- [Database Guide](Database-Guide) - Schema and queries
- [API Documentation](API-DOCUMENTATION) - Complete API reference

### Customize

- **Add more sports**: Edit `src/jobs/odds-sync.job.ts`
- **Change sync frequency**: Modify cron schedule in `src/jobs/`
- **Customize UI**: Edit React components in `dashboard/frontend/src/components/`
- **Add new MCP tools**: Extend `mcp/sports_mcp_server.py`

### Get Help

- **Issues**: [GitHub Issues](https://github.com/yourusername/BetTrack/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/BetTrack/discussions)
- **Documentation**: [Wiki Home](home)

---

## Cheat Sheet

### MCP Server Commands

```bash
# Start server manually
python mcp/sports_mcp_server.py

# Check Python version
python --version  # Should be 3.11+

# Install dependencies
pip install -r mcp/requirements.txt
```

### Dashboard Commands

```bash
# Backend
cd dashboard/backend
npm run dev          # Development
npm run build        # Production build
npm run prisma:studio # Database UI
npm run test         # Run tests

# Frontend
cd dashboard/frontend
npm run dev          # Development
npm run build        # Production build
npm run preview      # Preview build
npm run test         # Run tests
```

### Database Commands

```bash
cd dashboard/backend

# Migrations
npm run prisma:migrate       # Apply migrations
npm run prisma:migrate reset # Reset database
npm run prisma:generate      # Generate Prisma client

# Utilities
npm run init:sports          # Initialize sports
npm run sync:odds            # Manual odds sync
npm run resolve:outcomes     # Settle bets
```

### Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild
docker-compose build

# Execute commands in container
docker-compose exec backend npm run prisma:studio
```

---

Happy betting tracking! 🎯
