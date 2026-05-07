# Troubleshooting Guide

Solutions to common issues with BetTrack MCP Server and Dashboard.

## Table of Contents

- [MCP Server Issues](#mcp-server-issues)
- [Dashboard Issues](#dashboard-issues)
- [Database Issues](#database-issues)
- [API Integration Issues](#api-integration-issues)
- [Getting Help](#getting-help)

---

## MCP Server Issues

### MCP Server Not Appearing in Claude

**Symptoms**:
- Claude Desktop doesn't list sports data tools
- "Unknown tool" errors when trying to use tools

**Solutions**:

1. **Restart Claude Desktop completely**
   - Close Claude Desktop entirely (not just the window)
   - Reopen Claude Desktop
   - Create a new conversation

2. **Verify MCPB installation**
   - Open Claude Desktop Settings → Developer
   - Look for "sports-data-mcp" in installed packages
   - If missing, download latest `.mcpb` file and reinstall

3. **Check config directory**
   - Locate your config directory for your OS:
     - Windows: `%APPDATA%\Claude\sports-mcp-config\`
     - macOS: `~/Library/Application Support/Claude/sports-mcp-config/`
     - Linux: `~/.config/Claude/sports-mcp-config/`
   - If missing, create the directory manually

4. **Verify Python version (if using manual installation)**
   ```bash
   python --version  # Must be 3.11 or higher
   ```

### "ODDS_API_KEY not configured"

**Symptoms**:
- Error when using `get_odds`, `search_odds`, or similar tools
- "API key is required" message

**Solutions**:

1. **Create or update .env file**
   - Locate config directory (see above)
   - Create `.env` file (if it doesn't exist)
   - Add your API key: `ODDS_API_KEY=your_api_key_here`
   - **Important**: No quotes, no extra spaces

2. **Verify API key is correct**
   - Log into [the-odds-api.com](https://the-odds-api.com/account/)
   - Copy the exact key shown (32 alphanumeric characters)
   - Ensure you copy the full string

3. **Restart Claude Desktop**
   - After updating .env, close and reopen Claude Desktop
   - The server reloads configuration only on startup

4. **Get a new API key if needed**
   - Visit [the-odds-api.com](https://the-odds-api.com)
   - Click "Account" or "API Key" section
   - Generate a new key
   - Update your .env file

### "Rate limit exceeded" Error

**Symptoms**:
- Intermittent errors: "Rate limit exceeded"
- "x-requests-remaining: 0" in error messages

**Cause**: Free API tier limit (500 requests/month) reached

**Solutions**:

1. **Check your API quota**
   - Log into [the-odds-api.com/account/](https://the-odds-api.com/account/)
   - View "Requests Used" for current month
   - If at 500, you must wait until next month or upgrade

2. **Upgrade to paid tier**
   - Visit [the-odds-api.com/pricing](https://the-odds-api.com/pricing)
   - Plans start at $25/month for 5,000 requests

3. **Reduce API usage (temporary workaround)**
   - Set `BOOKMAKERS_FILTER` in .env to only your preferred sportsbooks
   - This reduces response size and request count

### ESPN Tools Return Empty Results

**Symptoms**:
- `get_espn_scoreboard()`, `get_espn_teams()`, etc. return empty or error

**Note**: ESPN tools don't require an API key and should work without Odds API key

**Solutions**:

1. **Check internet connection**
   - Verify ESPN API is accessible: `curl https://site.api.espn.com/`
   - Test from Claude Desktop by asking: "Get NFL scores"

2. **Verify sport/league parameters**
   - Ensure sport key is valid: `americanfootball_nfl`, `basketball_nba`, etc.
   - Check league parameter: `nfl`, `nba`, `nhl`, `mlb`, etc.

3. **Check ESPN API availability**
   - ESPN API is public but may have occasional downtime
   - Check [ESPN status page](https://status.espn.com) if persistent

### Fuzzy Team Name Search Not Finding Team

**Symptoms**:
- `search_odds("Lakers")` returns no results
- `find_team("LAL", "nba")` returns "not found"

**Causes**: Team name spelling variation or abbreviation not in reference

**Solutions**:

1. **Try full official team name**
   - Instead of "Lakers", try "Los Angeles Lakers"
   - Instead of "LAL", try full city name

2. **Use exact ESPN team name**
   - Check [ESPN Teams list](https://www.espn.com/nba/teams)
   - Use exact team name as shown on ESPN

3. **Report missing team**
   - Open issue on [GitHub Issues](https://github.com/WFord26/BetTrack/issues)
   - Include: Team name, sport, expected result

---

## Dashboard Issues

### Cannot Connect to Backend (ERR_CONNECTION_REFUSED)

**Symptoms**:
- Frontend shows "API connection failed"
- Browser console shows: `http://localhost:3001/api - ERR_CONNECTION_REFUSED`

**Solutions**:

1. **Verify backend is running**
   - Check your terminal where backend is running
   - If not running, start it: `npm run dev:backend`
   - Backend should log: "Server running on port 3001"

2. **Check port 3001**
   - Verify nothing else is using port 3001:
     - macOS/Linux: `lsof -i :3001`
     - Windows: `netstat -ano | findstr :3001`
   - If port is in use, change PORT in backend .env

3. **Verify CORS configuration**
   - Check backend .env: `CORS_ORIGIN=http://localhost:5173`
   - Must match frontend URL exactly
   - Restart backend after changing

4. **Check frontend .env**
   - Verify `VITE_API_URL=http://localhost:3001/api`
   - Restart frontend dev server: `npm run dev:frontend`

### Database Connection Error

**Symptoms**:
- Backend won't start: "ECONNREFUSED 127.0.0.1:5432"
- "Database connection failed" error

**Solutions**:

1. **Verify PostgreSQL is running**
   ```bash
   # macOS/Linux
   psql -U postgres
   
   # Windows (if installed)
   "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres
   ```
   - If command fails, PostgreSQL isn't running

2. **Start PostgreSQL**
   ```bash
   # macOS (Homebrew)
   brew services start postgresql
   
   # Linux (Systemd)
   sudo systemctl start postgresql
   
   # Docker
   docker run -d -e POSTGRES_PASSWORD=password postgres:16-alpine
   ```

3. **Check DATABASE_URL format**
   ```bash
   # Correct format
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   
   # Common mistakes
   # ❌ Missing colon: postgresql://user@localhost
   # ❌ Wrong protocol: mysql://user:pass...
   # ❌ Localhost name issues: try 127.0.0.1 instead
   ```

4. **Verify database exists**
   ```bash
   psql -U postgres -c "CREATE DATABASE sports_betting_dashboard;"
   ```

5. **Run migrations**
   ```bash
   npm run prisma:migrate
   ```

### CORS Error: "Access to XMLHttpRequest blocked"

**Symptoms**:
- Browser console shows CORS error
- Frontend can't fetch from backend

**Cause**: CORS_ORIGIN in backend doesn't match frontend URL

**Solutions**:

1. **Check both URLs match exactly**
   - Frontend URL in browser: `http://localhost:5173`
   - Backend CORS_ORIGIN: `CORS_ORIGIN=http://localhost:5173`
   - **Both must match exactly** (including `http://` vs `https://`)

2. **Restart backend after changing**
   ```bash
   # Kill current process and restart
   npm run dev:backend
   ```

3. **For production**
   - Frontend: `https://example.com`
   - Backend CORS_ORIGIN: `https://example.com`
   - Backend BASE_URL: `https://api.example.com` (if separate)

### Odds Data Not Syncing

**Symptoms**:
- Games show "No odds available"
- Odds never update automatically

**Solutions**:

1. **Check ODDS_API_KEY in backend .env**
   - Ensure key is set correctly (see ODDS API Key issue above)

2. **Verify background jobs are running**
   - Check backend logs for "Odds sync scheduled" message
   - Should see sync attempts every 10 minutes (or ODDS_SYNC_INTERVAL value)

3. **Manual sync test**
   - Make POST request to backend: `curl -X POST http://localhost:3001/api/admin/sync-odds`
   - Check logs for success/failure

4. **Increase sync interval if rate limited**
   - Backend .env: `ODDS_SYNC_INTERVAL=20` (20 minutes instead of 10)
   - Reduces API usage but delays odds updates

### Game Scores Not Updating

**Symptoms**:
- Game scores show wrong numbers
- Live games don't show real-time scores

**Cause**: Score data from ESPN API or background job isn't running

**Solutions**:

1. **Verify ESPN API is accessible**
   - Try in browser: `https://site.api.espn.com/site/api/site/v2/sports/football/nfl/scoreboard`

2. **Check outcome resolver job**
   - Backend should run hourly
   - Check logs for "Outcome resolution completed"

3. **Manual resolution test**
   - `curl -X POST http://localhost:3001/api/admin/resolve-outcomes`

---

## Database Issues

### "ERROR: relation \"public.Sport\" does not exist"

**Symptoms**:
- Backend crashes on startup
- Error mentioning missing tables

**Cause**: Database migrations haven't been run

**Solutions**:

```bash
# From dashboard/backend directory
npm run prisma:migrate

# Or if AUTO_MIGRATE=true in .env
# Just restart backend - migrations run automatically
```

### Prisma Schema Out of Sync

**Symptoms**:
- TypeScript errors about missing fields
- "Unknown field in User model" type errors

**Solutions**:

```bash
# Regenerate Prisma client
npm run prisma:generate

# For schema changes
npm run prisma:migrate

# Reset database (development only - DESTROYS DATA)
npm run prisma:reset
```

### Database Performance Issues

**Symptoms**:
- Backend is slow
- Queries taking 30+ seconds

**Solutions**:

1. **Check if indexes exist**
   - Read [Database Guide](Database-Guide.md) indexes section
   - Verify migrations included indexes

2. **Clear old data (development)**
   ```bash
   npm run prisma:reset
   ```

3. **Analyze query performance**
   - Enable slow query log in PostgreSQL
   - Use Prisma Studio: `npm run prisma:studio`

---

## API Integration Issues

### "Invalid sport key"

**Symptoms**:
- Error: "Sport 'basketball_nba' not found"
- Tools don't recognize sport parameter

**Solutions**:

1. **Use correct sport key format**
   - Valid: `americanfootball_nfl`, `basketball_nba`, `ice_hockey_nhl`
   - Invalid: `nfl`, `NFL`, `american-football`

2. **Get list of valid sports**
   - Use tool: `get_available_sports()`
   - Check [docs/AVAILABLE-TOOLS.md](AVAILABLE-TOOLS.md) for full list

### No Markets Available for Sport

**Symptoms**:
- `get_odds("sport", markets="player_points")` returns empty
- Market not available error

**Cause**: Market not offered for that sport/league combination

**Solutions**:

1. **Check which markets are available**
   - Some player props only available for certain sports
   - NFL: Pass yards, touchdowns, rushing yards
   - NBA: Points, rebounds, assists
   - Check tool documentation for each market

2. **Use simpler markets**
   - Try `h2h` (moneyline) or `spreads` first
   - These are available for all sports

---

## Getting Help

### Before Opening an Issue

1. **Check this guide** - Your issue may be covered above
2. **Check [Configuration Reference](Configuration-Reference.md)** - Verify all settings
3. **Search [GitHub Issues](https://github.com/WFord26/BetTrack/issues)** - Similar issues may be already reported
4. **Check logs** - Look for error messages in Claude Desktop console or backend logs

### Providing Useful Error Reports

When reporting an issue, include:

1. **What you tried**
   - Command or tool you used
   - Parameters you passed
   - Exact steps to reproduce

2. **What happened**
   - Full error message (copy/paste)
   - Screenshot of error (if applicable)
   - Logs if available

3. **System info**
   - OS (Windows/macOS/Linux)
   - Python version (for MCP)
   - Node version (for Dashboard)
   - PostgreSQL version (if using Dashboard)

4. **Configuration**
   - Deployment type (MCP only, Dashboard, Both)
   - Installation method (MCPB, Manual, Docker)
   - Have you modified any files?

---

## Next Steps

- **[Configuration Reference](Configuration-Reference.md)** - All configuration options
- **[Quick Start](Quick-Start.md)** - Standard setup walkthrough
- **[Installation Guide](Installation-Guide.md)** - Detailed installation steps
