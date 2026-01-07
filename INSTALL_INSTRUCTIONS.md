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

## Support

For issues or questions:
- GitHub: https://github.com/yourusername/sports-odds-mcp/issues
- The Odds API: https://the-odds-api.com/support

## Features

### Odds API Tools (15 tools available)
- Get available sports
- Get betting odds
- Get live scores
- Search for team odds
- Get event-specific odds

### ESPN API Tools
- Live scoreboards
- Team information
- League standings
- Team schedules
- Latest news
- Player information
- Game summaries

Enjoy your sports data access in Claude!
