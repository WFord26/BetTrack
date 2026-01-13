# Getting The Odds API Key

Complete guide to obtaining and configuring your API key from The Odds API for BetTrack.

## Table of Contents

- [Why You Need An API Key](#why-you-need-an-api-key)
- [Registration Process](#registration-process)
- [Free Tier Details](#free-tier-details)
- [Finding Your API Key](#finding-your-api-key)
- [Configuring BetTrack](#configuring-bettrack)
- [Rate Limiting](#rate-limiting)
- [Paid Tiers](#paid-tiers)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Why You Need An API Key

The Odds API provides real-time sports betting data that powers BetTrack:

- **Live betting odds** from 10+ bookmakers (DraftKings, FanDuel, BetMGM, etc.)
- **Real-time scores** and game results
- **Multiple markets** (moneyline, spreads, totals, player props)
- **Historical odds** for line movement tracking
- **7 sports leagues** (NFL, NBA, NHL, MLB, NCAAB, EPL, UEFA)

**Required for**:
- ✅ MCP Server (Claude Desktop integration)
- ✅ Dashboard (bet tracking web app)

---

## Registration Process

### Step 1: Visit The Odds API

Navigate to [https://the-odds-api.com/](https://the-odds-api.com/)

### Step 2: Create Account

1. Click **"Sign Up"** or **"Get Started"** in the top navigation
2. Fill out registration form:
   - Email address
   - Password (8+ characters)
   - Company/Organization (optional for free tier)
   - Use case (select "Personal Project" or "Sports Analytics")

### Step 3: Verify Email

1. Check your email inbox
2. Click verification link from `noreply@the-odds-api.com`
3. Complete email verification

### Step 4: Access Dashboard

1. Log in at [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
2. You'll be redirected to your account dashboard
3. API key will be displayed immediately

---

## Free Tier Details

The Odds API offers a generous free tier:

### Quota
- **500 requests per month**
- Resets on the 1st of each month
- No credit card required

### What's Included
- ✅ All sports and leagues
- ✅ All betting markets (h2h, spreads, totals, props)
- ✅ Live scores and results
- ✅ Multiple bookmakers
- ✅ Historical odds (within request limit)

### Limitations
- ❌ 500 requests per month (not per day)
- ❌ No commercial use
- ❌ No webhook support
- ❌ Standard support only

### Request Consumption

Different endpoints consume requests differently:

| Endpoint | Requests Consumed |
|----------|-------------------|
| List sports | 1 request |
| Get odds (single sport) | 1 request |
| Get scores (single sport) | 1 request |
| Player props (single sport) | 1 request |

**Example**: Fetching odds for NBA games consumes 1 request, regardless of how many games are returned.

---

## Finding Your API Key

### Method 1: Account Dashboard

1. Log in to [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
2. Your API key is displayed at the top of the page
3. Look for a section labeled **"Your API Key"**
4. Click **"Copy"** button or manually copy the key

**Key Format**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (32 alphanumeric characters)

### Method 2: API Documentation

1. Navigate to [https://the-odds-api.com/liveapi/guides/v4/](https://the-odds-api.com/liveapi/guides/v4/)
2. Your API key is automatically included in code examples
3. Look for `apiKey=YOUR_KEY` in example URLs

### Regenerating Your Key

If you need to regenerate your API key:

1. Go to account dashboard
2. Click **"Regenerate API Key"**
3. Confirm regeneration (old key will stop working immediately)
4. Update BetTrack configuration with new key

---

## Configuring BetTrack

### MCP Server Configuration

#### Option 1: Claude Desktop Config (Recommended)

Edit your Claude Desktop configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bettrack": {
      "command": "python",
      "args": ["C:/path/to/BetTrack/mcp/sports_mcp_server.py"],
      "env": {
        "ODDS_API_KEY": "your_32_character_api_key_here"
      }
    }
  }
}
```

#### Option 2: Environment File

Create `.env` file in `BetTrack/mcp/` directory:

```bash
ODDS_API_KEY=your_32_character_api_key_here
BOOKMAKERS_FILTER=draftkings,fanduel,betmgm
BOOKMAKERS_LIMIT=5
```

### Dashboard Configuration

Edit `.env` file in `dashboard/backend/` directory:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/bettrack
ODDS_API_KEY=your_32_character_api_key_here

# Optional
SESSION_SECRET=generate_random_string_here
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Verify Configuration

**MCP Server**:
```bash
cd mcp
python sports_mcp_server.py
# Should see "MCP Server initialized successfully"
```

**Dashboard Backend**:
```bash
cd dashboard/backend
npm run dev
# Should see "Server running on port 3001"
# Check logs for "Odds API connected successfully"
```

---

## Rate Limiting

### Tracking Usage

The Odds API includes usage information in response headers:

```
x-requests-remaining: 487
x-requests-used: 13
```

BetTrack automatically logs remaining requests:

```
[INFO] Odds API request completed. Remaining: 487/500
```

### Dashboard Background Jobs

The dashboard runs automated odds syncing:

- **Frequency**: Every 5 minutes
- **Consumption**: 7 requests per sync (one per sport)
- **Daily usage**: ~2,000 requests per day
- **Monthly usage**: ~60,000 requests per month

**⚠️ WARNING**: Free tier (500/month) is NOT sufficient for dashboard background jobs. Disable auto-sync or upgrade to paid tier.

### Disabling Auto-Sync

To disable automatic odds syncing:

**Option 1**: Comment out cron job in `dashboard/backend/src/jobs/odds-sync.job.ts`:

```typescript
// cron.schedule('*/5 * * * *', async () => {
//   await oddsSyncService.syncOdds();
// });
```

**Option 2**: Use manual sync only via admin API:

```bash
curl -X POST http://localhost:3001/api/admin/sync-odds
```

### MCP Server Usage

The MCP server makes requests only when Claude asks for data:

- **No automatic syncing**
- **On-demand requests only**
- **Typical usage**: 10-50 requests per day
- **Monthly usage**: 300-1,500 requests per month

**✅ Free tier is sufficient for MCP server usage**

---

## Paid Tiers

If you exceed free tier limits, The Odds API offers paid plans:

### Starter Plan
- **$25/month**
- **10,000 requests per month**
- All sports and markets
- Email support

### Professional Plan
- **$75/month**
- **50,000 requests per month**
- Priority support
- Webhook notifications
- Commercial use allowed

### Enterprise Plan
- **Custom pricing**
- **Unlimited requests**
- Dedicated support
- SLA guarantees
- Custom integrations

### Upgrading

1. Log in to [https://the-odds-api.com/account/](https://the-odds-api.com/account/)
2. Click **"Upgrade Plan"**
3. Select desired tier
4. Enter payment information
5. API key remains the same (no configuration changes needed)

---

## Best Practices

### 1. Secure Your API Key

**DO**:
- ✅ Store in `.env` file (never commit to git)
- ✅ Use environment variables
- ✅ Add `.env` to `.gitignore`
- ✅ Use different keys for dev/prod

**DON'T**:
- ❌ Hardcode in source code
- ❌ Commit to version control
- ❌ Share publicly in screenshots
- ❌ Use same key across multiple projects

### 2. Optimize Request Usage

**Filter Sports**:
```bash
# Only fetch odds for sports you care about
BOOKMAKERS_FILTER=draftkings,fanduel
BOOKMAKERS_LIMIT=3
```

**Cache Results**:
- MCP server caches results for 5 minutes
- Dashboard stores odds in database
- Avoid redundant API calls

**Batch Requests**:
- Fetch all games for a sport in single request
- Use `regions` parameter to limit bookmakers

### 3. Monitor Usage

**Check remaining requests**:
```bash
# Dashboard backend logs
[INFO] Odds API usage: 487/500 requests remaining

# MCP server logs
[DEBUG] x-requests-remaining: 487
```

**Set up alerts**:
- Monitor logs for low quota warnings
- Disable auto-sync if approaching limit
- Upgrade plan before running out

### 4. Handle Rate Limits

BetTrack includes built-in error handling:

```typescript
try {
  const odds = await fetchOdds();
} catch (error) {
  if (error.status === 429) {
    // Rate limit exceeded - wait and retry
    console.error('Rate limit exceeded. Requests remaining: 0');
  }
}
```

---

## Troubleshooting

### Invalid API Key

**Error**: `401 Unauthorized` or `Invalid API key`

**Solutions**:
1. Verify key copied correctly (32 characters, no spaces)
2. Check `.env` file syntax: `ODDS_API_KEY=key` (no quotes)
3. Restart MCP server or backend after changing `.env`
4. Regenerate key on The Odds API dashboard

### Rate Limit Exceeded

**Error**: `429 Too Many Requests` or `Monthly quota exceeded`

**Solutions**:
1. Check usage: `x-requests-remaining` header
2. Wait until next month for quota reset
3. Disable dashboard auto-sync
4. Upgrade to paid tier

### No Data Returned

**Error**: Empty results or `No games found`

**Solutions**:
1. Verify API key is active (not expired trial)
2. Check if sport is in season (NFL, NBA, NHL have off-seasons)
3. Verify bookmakers are available for your region
4. Test with The Odds API documentation examples

### Connection Timeout

**Error**: `ETIMEDOUT` or `Request timeout`

**Solutions**:
1. Check internet connection
2. Verify firewall allows HTTPS connections
3. Test API endpoint directly: `curl https://api.the-odds-api.com/v4/sports`
4. Check The Odds API status page for outages

### Environment Variables Not Loading

**Error**: `ODDS_API_KEY is required`

**Solutions**:
1. Verify `.env` file exists in correct directory
2. Check file permissions (must be readable)
3. Restart application after editing `.env`
4. Use absolute path in Claude Desktop config instead

---

## Testing Your API Key

### Command Line Test

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://api.the-odds-api.com/v4/sports?apiKey=YOUR_API_KEY"

# Expected output:
[
  {
    "key": "basketball_nba",
    "group": "Basketball",
    "title": "NBA",
    "description": "US Basketball",
    "active": true
  },
  ...
]
```

### MCP Server Test

```bash
cd mcp
python sports_mcp_server.py

# In Claude Desktop, ask:
"Show me NBA games today"

# Should return formatted game list with odds
```

### Dashboard Test

```bash
# Start backend
cd dashboard/backend
npm run dev

# Initialize sports
curl -X POST http://localhost:3001/api/admin/init-sports

# Sync odds (manual)
curl -X POST http://localhost:3001/api/admin/sync-odds

# Check stats
curl http://localhost:3001/api/admin/stats
```

---

## Additional Resources

### Official Documentation
- **API Documentation**: [https://the-odds-api.com/liveapi/guides/v4/](https://the-odds-api.com/liveapi/guides/v4/)
- **API Explorer**: [https://the-odds-api.com/sports-odds-data/api-explorer.html](https://the-odds-api.com/sports-odds-data/api-explorer.html)
- **FAQ**: [https://the-odds-api.com/faq](https://the-odds-api.com/faq)

### BetTrack Guides
- **[Quick Start Guide](Quick-Start)** - Complete setup walkthrough
- **[MCP Server Guide](MCP-Server-Guide)** - MCP configuration details
- **[Dashboard Guide](Dashboard-Guide)** - Backend API setup

### Support
- **The Odds API Support**: support@the-odds-api.com
- **BetTrack Issues**: [GitHub Issues](https://github.com/WFord26/BetTrack/issues)

---

## Summary Checklist

- [ ] Create account at https://the-odds-api.com/
- [ ] Verify email address
- [ ] Copy API key from dashboard
- [ ] Add key to MCP `.env` or Claude config
- [ ] Add key to Dashboard backend `.env`
- [ ] Test MCP server: "Show me NBA games"
- [ ] Test dashboard: Initialize sports + sync odds
- [ ] Monitor usage with `x-requests-remaining` header
- [ ] Disable dashboard auto-sync if using free tier
- [ ] Secure API key (never commit to git)

---

**Status**: Production Ready ✅  
**Last Updated**: January 13, 2026
