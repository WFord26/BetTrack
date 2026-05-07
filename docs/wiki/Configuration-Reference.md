# Configuration Reference

Complete guide to all environment variables for BetTrack MCP Server and Dashboard.

## Table of Contents

- [MCP Server Configuration](#mcp-server-configuration)
- [Dashboard Backend Configuration](#dashboard-backend-configuration)
- [Dashboard Frontend Configuration](#dashboard-frontend-configuration)
- [Configuration by Deployment Type](#configuration-by-deployment-type)
- [Common Issues](#common-issues)

---

## MCP Server Configuration

Environment variables for the BetTrack MCP Server running in Claude Desktop.

### Required Variables

#### `ODDS_API_KEY`

**Type**: String  
**Required**: Yes  
**Description**: API key from The Odds API for accessing live betting odds

**How to get**:
1. Visit [https://the-odds-api.com](https://the-odds-api.com)
2. Sign up for a free account
3. Copy your API key from the account dashboard
4. Free tier: 500 requests per month

**Example**:
```bash
ODDS_API_KEY=abc123def456ghi789jkl012mno345
```

### Optional Variables

#### `BOOKMAKERS_FILTER`

**Type**: Comma-separated string  
**Required**: No  
**Default**: All bookmakers included  
**Description**: Filter odds results to only specific sportsbooks

**Common bookmakers**:
- `draftkings` - DraftKings
- `fanduel` - FanDuel
- `betmgm` - BetMGM
- `caesars` - Caesars Sports
- `barstool` - Barstool Sports
- `pointsbet` - PointsBet
- `bet365` - Bet365
- `bovada` - Bovada
- `williamhill` - William Hill

**Example**:
```bash
# Focus on major US sportsbooks
BOOKMAKERS_FILTER=draftkings,fanduel,betmgm
```

**Note**: Filtering reduces API quota usage and focuses results on your preferred books.

#### `BOOKMAKERS_LIMIT`

**Type**: Integer  
**Required**: No  
**Default**: 5  
**Description**: Maximum number of bookmakers to include in odds results per game

**Example**:
```bash
BOOKMAKERS_LIMIT=3
```

**Use case**: Show only top 3 bookmakers to keep API response sizes small.

#### `LOG_LEVEL`

**Type**: String  
**Required**: No  
**Default**: INFO  
**Description**: Logging verbosity level

**Valid values**:
- `DEBUG` - Detailed debug information
- `INFO` - General information (default)
- `WARNING` - Warning messages only
- `ERROR` - Error messages only
- `CRITICAL` - Critical errors only

**Example**:
```bash
LOG_LEVEL=DEBUG  # For troubleshooting
```

---

## Dashboard Backend Configuration

Environment variables for the Node.js backend server.

### Database Configuration

#### Database Connection (Option A: Composite)

Use individual variables to build the connection string:

```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=sports_betting_dashboard
DATABASE_USER=sports_user
DATABASE_PASSWORD=sports_password_change_in_production
```

**Priority**: If `DATABASE_URL` is set, these variables are ignored.

#### Database Connection (Option B: Direct URL)

Provide a complete connection string:

```bash
DATABASE_URL=postgresql://sports_user:sports_password@localhost:5432/sports_betting_dashboard
```

**Format**: `postgresql://username:password@host:port/database`

**Note**: Use this option for cloud-hosted databases (Heroku, AWS RDS, Railway, etc.)

### API Integration

#### `ODDS_API_KEY`

**Type**: String  
**Required**: Yes (for odds sync jobs)  
**Description**: Same as MCP server - required for backend to fetch and sync odds

```bash
ODDS_API_KEY=your_odds_api_key_here
```

#### `API_SPORTS_KEY`

**Type**: String  
**Required**: No  
**Description**: Optional API key for API-Sports (alternative sports data source)

#### `API_SPORTS_TIER`

**Type**: String  
**Default**: pro  
**Valid values**: basic, pro, advanced  
**Description**: API-Sports subscription tier (if using API_SPORTS_KEY)

### Server Configuration

#### `PORT`

**Type**: Integer  
**Required**: No  
**Default**: 3001  
**Description**: Port for Express server to listen on

```bash
PORT=3001
```

#### `NODE_ENV`

**Type**: String  
**Default**: development  
**Valid values**: development, production, test  
**Description**: Environment mode for optimizations and logging

#### `BASE_URL`

**Type**: String  
**Required**: Yes  
**Description**: Public base URL for the backend server

**Examples**:
```bash
# Development
BASE_URL=http://localhost:3001

# Production
BASE_URL=https://api.bettrack.example.com
```

#### `CORS_ORIGIN`

**Type**: String  
**Required**: Yes (for frontend requests)  
**Description**: URL of the frontend application (for CORS headers)

**Examples**:
```bash
# Development
CORS_ORIGIN=http://localhost:5173

# Production
CORS_ORIGIN=https://bettrack.example.com
```

### Authentication

#### `AUTH_MODE`

**Type**: String  
**Default**: none  
**Valid values**: none, oauth2  
**Description**: Authentication strategy

**Options**:
- `none` - Standalone mode, no user authentication
- `oauth2` - Multi-user with OAuth2 (requires Microsoft/Google config)

#### `SESSION_SECRET`

**Type**: String  
**Required**: Yes (if AUTH_MODE=oauth2)  
**Description**: Secret key for session encryption

**Generate a secure value**:
```bash
openssl rand -hex 32
```

#### `JWT_SECRET`

**Type**: String  
**Required**: Yes (if using API token authentication)  
**Description**: Secret key for JWT token signing

**Generate a secure value**:
```bash
openssl rand -hex 32
```

### OAuth2 Configuration (Optional)

Only required if `AUTH_MODE=oauth2`.

#### Microsoft Azure AD

```bash
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=common
```

#### Google OAuth2

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

### Real-time Updates

#### `ENABLE_WEBSOCKETS`

**Type**: Boolean  
**Default**: true  
**Description**: Enable WebSocket connections for real-time game updates

#### `STATS_POLL_INTERVAL_MS`

**Type**: Integer  
**Default**: 15000  
**Description**: Interval in milliseconds for polling live game stats

```bash
STATS_POLL_INTERVAL_MS=15000  # 15 seconds
```

### Background Jobs

#### `ODDS_SYNC_INTERVAL`

**Type**: Integer  
**Unit**: Minutes  
**Default**: 10  
**Description**: How often to sync fresh odds from The Odds API

```bash
ODDS_SYNC_INTERVAL=10  # Sync every 10 minutes
```

#### `AUTO_MIGRATE`

**Type**: Boolean  
**Default**: false  
**Description**: Automatically run database migrations on startup

**Use cases**:
- Docker deployments where migrations should auto-run
- CI/CD pipelines
- Development environments

```bash
AUTO_MIGRATE=true
```

### Caching (Optional)

#### `REDIS_URL`

**Type**: String  
**Required**: No  
**Description**: Redis connection URL for caching and session storage

**Format**:
```bash
REDIS_URL=redis://localhost:6379
```

---

## Dashboard Frontend Configuration

Environment variables for the React application.

### API Configuration

#### `VITE_API_URL`

**Type**: String  
**Required**: Yes  
**Description**: Base URL for backend API requests

**Examples**:
```bash
# Development
VITE_API_URL=http://localhost:3001/api

# Production
VITE_API_URL=https://api.bettrack.example.com/api
```

**Note**: Must include `/api` path; frontend appends routes to this URL.

---

## Configuration by Deployment Type

### 1. MCP Server Only (Claude Desktop)

**Minimum required**:
```bash
ODDS_API_KEY=your_api_key_here
```

**Optional**:
```bash
BOOKMAKERS_FILTER=draftkings,fanduel
BOOKMAKERS_LIMIT=3
LOG_LEVEL=INFO
```

### 2. Dashboard with Docker Compose

**Backend .env**:
```bash
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=bettrack
DATABASE_USER=bettrack_user
DATABASE_PASSWORD=secure_password
ODDS_API_KEY=your_odds_api_key
SESSION_SECRET=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
NODE_ENV=production
BASE_URL=http://localhost
CORS_ORIGIN=http://localhost
AUTO_MIGRATE=true
PORT=3001
```

**Frontend .env**:
```bash
VITE_API_URL=http://localhost/api
```

### 3. Production Deployment with Secrets

Use Docker secrets for sensitive values:

**Create secrets**:
```bash
mkdir -p secrets
echo -n "your_odds_api_key" > secrets/odds_api_key.txt
echo -n "$(openssl rand -hex 32)" > secrets/session_secret.txt
echo -n "$(openssl rand -hex 32)" > secrets/jwt_secret.txt
```

**Backend .env**:
```bash
DATABASE_HOST=postgres
DATABASE_NAME=bettrack
DATABASE_USER=bettrack_user
NODE_ENV=production
BASE_URL=https://api.example.com
CORS_ORIGIN=https://example.com
AUTO_MIGRATE=false
# Secrets are loaded automatically from /run/secrets/
```

**Priority order**:
1. Docker secrets (`/run/secrets/*`)
2. Environment variables
3. .env file values

---

## Common Issues

### Issue: "ODDS_API_KEY not configured"

**Cause**: Missing or incorrectly set API key

**Solutions**:
1. Verify key is set in your `.env` file (no trailing spaces)
2. For MCP: Check config directory path matches your OS
3. Restart Claude Desktop after changing .env
4. Get a new key from [the-odds-api.com](https://the-odds-api.com)

### Issue: "Database connection failed"

**Cause**: Incorrect DATABASE_URL or database not running

**Solutions**:
1. Verify PostgreSQL is running: `psql -U postgres`
2. Check DATABASE_URL format is correct
3. Ensure database user exists: `CREATE USER sports_user WITH PASSWORD 'password';`
4. Create database: `CREATE DATABASE sports_betting_dashboard;`

### Issue: CORS errors in dashboard

**Cause**: CORS_ORIGIN doesn't match frontend URL

**Solutions**:
1. Check CORS_ORIGIN matches exactly (including protocol and port)
2. Frontend at `http://localhost:5173` → set `CORS_ORIGIN=http://localhost:5173`
3. Restart backend after changing CORS_ORIGIN

### Issue: "Rate limit exceeded" from Odds API

**Cause**: Free tier limit (500 requests/month) reached

**Solutions**:
1. Upgrade to paid tier at [the-odds-api.com/pricing](https://the-odds-api.com/pricing)
2. Increase `ODDS_SYNC_INTERVAL` to sync less frequently
3. Use `BOOKMAKERS_FILTER` to reduce response size and requests

---

## Next Steps

- **[Installation Guide](Installation-Guide.md)** - Full setup walkthrough
- **[Troubleshooting](Troubleshooting.md)** - Common problems and solutions
- **[Quick Start](Quick-Start.md)** - Get running in 5 minutes
