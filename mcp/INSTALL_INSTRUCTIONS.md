# Sports Data MCP - Setup Instructions

## Quick Start

After installing this MCP package in Claude Desktop, you need to configure your Odds API key:

### Step 1: Get Your API Key

1. Visit [https://the-odds-api.com](https://the-odds-api.com)
2. Sign up for a free account
3. Copy your API key

### Step 2: Configure the .env File

1. Locate the installed package directory:
   - The package is installed in Claude Desktop's MCP directory
   - Look for a `.env` file in the same folder as `sports_mcp_server.py`

2. Edit the `.env` file:
   ```bash
   ODDS_API_KEY=your_api_key_here
   ```

3. Replace `your_api_key_here` with your actual API key from The Odds API

### Step 3: Restart Claude Desktop

After updating the `.env` file, restart Claude Desktop for the changes to take effect.

## Testing

Try asking Claude:
- "What are today's NBA games?"
- "Show me NFL odds for this weekend"
- "Get the current NBA standings"

## Supported Sports

- NFL (American Football)
- NBA (Basketball)
- MLB (Baseball)
- NHL (Hockey)
- College Football
- College Basketball
- Soccer leagues
- And many more...

## Rate Limits

**The Odds API (Free Tier):**
- 500 requests per month
- Monitor your usage at [https://the-odds-api.com/account/](https://the-odds-api.com/account/)

**ESPN API:**
- No API key required
- Public endpoints with reasonable rate limiting

## Troubleshooting

**"Odds API not configured" error:**
- Check that ODDS_API_KEY is set in the .env file
- Verify the API key is valid at the-odds-api.com
- Restart Claude Desktop after changing the .env file

**"Invalid API key" error:**
- Double-check your API key from the-odds-api.com
- Make sure there are no extra spaces or quotes around the key
- Verify your API key hasn't expired

## Dashboard Integration (Optional)

The BetTrack dashboard tools are built into this same server. There is nothing
extra to install — add a key to the same `.env` file and restart Claude
Desktop:

```bash
DASHBOARD_API_KEY=sk_your_api_key_here
DASHBOARD_API_URL=https://your-dashboard.example.com
```

Generate the key in the dashboard under **Settings -> API Keys**. Grant it:

- **`bets`** for bet tracking tools (create a bet, list bets, exposure by game)
- **`stats`** for the analytics tools (arbitrage, closing line value, sharp
  money, line movement, market disagreement, bookmaker metrics)

Leave `DASHBOARD_API_KEY` unset and the server still runs normally; you just
get the sports data tools, and no dashboard tools appear in Claude. The
startup log tells you which mode you are in:

```
Dashboard connected at https://your-dashboard.example.com (26 tools registered)
```

or

```
DASHBOARD_API_KEY not set. Dashboard tools are unavailable; sports data tools work normally.
```

> **Security:** `DASHBOARD_API_URL` **must** use `https://` for any hosted or
> production deployment. Plain `http://` exposes your API key and bet data to
> anything on the network path. `http://localhost:3001` is acceptable **only**
> for local development on your own machine. The server logs a warning if you
> point a plain `http://` URL at a non-loopback host.

### Running the dashboard tools on their own

`dashboard_mcp_server.py` runs the dashboard tools with no sports data tools
attached. Most users do not need it — the combined server above already
includes everything. It is useful for pointing a second MCP server at a
different dashboard instance, or for debugging dashboard tools in isolation.

## Support

For issues or questions:
- GitHub: https://github.com/yourusername/sports-odds-mcp/issues
- The Odds API: https://the-odds-api.com/support

## Features

### Sports Data Tools (always available)

**The Odds API** — available sports, betting odds, live scores, event odds,
and natural language odds search across 70+ markets including player props.

**ESPN API** — live scoreboards, team info and schedules, league standings,
latest news, player and game lookups, plus formatted scoreboard and standings
tables.

### Dashboard Tools (when DASHBOARD_API_KEY is set)

**Bets and games** — create a bet, list your bets, bet details, active games,
game odds, team search, betting stats summary, advice context, and games
annotated with your open exposure.

**Analytics** (requires the `stats` permission on the key) — arbitrage
opportunities with a stake calculator, closing line value by sport and by
bookmaker, sharp money and contrarian plays, line movement including steam and
reverse moves, market disagreement, and bookmaker rankings and comparisons.

Enjoy your sports data access in Claude!
