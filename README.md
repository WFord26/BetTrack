<div align="center">
  <img src="dashboard/frontend/public/logo.svg" alt="Sports Data MCP Logo" width="400"/>
  
# Sports Data MCP

Model Context Protocol (MCP) server providing comprehensive sports data from multiple APIs with natural language query support for Claude Desktop.
</div>

## Features

### Data Sources

- **The Odds API** - Live betting odds from multiple bookmakers
  - Current and upcoming game odds
  - Multiple betting markets (moneyline, spreads, totals)
  - Score tracking
  - Natural language team/matchup search

- **ESPN API** - Comprehensive sports information
  - Live scoreboards
  - Team details and rosters
  - League standings
  - Game schedules
  - News and articles
  - Player information
  - Historical data

### Supported Sports

- **NFL** - American Football (Pro)
- **College Football**
- **NBA** - Basketball (Pro)
- **College Basketball** (Men's & Women's)
- **MLB** - Baseball (Pro)
- **NHL** - Hockey (Pro)
- **Soccer** - Multiple leagues worldwide
- **And many more...**

## Installation

### Prerequisites

- Python 3.11 or higher
- Claude Desktop
- The Odds API key (free tier available at [the-odds-api.com](https://the-odds-api.com))

### MCPB Installation (Recommended)

1. **Download the latest MCPB package** from the [Releases](https://github.com/yourusername/sports-odds-mcp/releases) page

2. **Install via Claude Desktop:**
   - Open Claude Desktop
   - Go to Settings → Developer
   - Click "Install MCP Package"
   - Select the downloaded `.mcpb` file

3. **Configure your API key:**
   - Create a `.env` file in your installation directory
   - Add: `ODDS_API_KEY=your_api_key_here`

### Manual Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/sports-odds-mcp.git
   cd sports-odds-mcp
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your ODDS_API_KEY
   ```

4. **Add to Claude Desktop config** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "sports-data": {
         "command": "python",
         "args": ["C:/path/to/sports-odds-mcp/mcp/sports_mcp_server.py"],
         "env": {
           "ODDS_API_KEY": "your_api_key_here"
         }
       }
     }
   }
   ```

## Usage

Once installed, you can query sports data using natural language in Claude Desktop. **New:** Visual scoreboard cards render automatically!

### Visual Scoreboards (NEW! 🎨)

Get beautiful, interactive scoreboard cards rendered directly in Claude:

**Example:**
- "Show me a visual scoreboard for NFL games" → Uses `get_visual_scoreboard()`
- "Create an interactive card for today's NBA games"
- "Display NHL scores with betting odds visually"

This returns structured data that Claude automatically renders as an **interactive React artifact** with:
- Team colors and logos
- Live scores and game status
- Expandable betting odds (spreads, totals)
- Smooth animations and hover effects
- Auto-refresh capabilities

### Example Queries

**Betting Odds:**
- "What are the current odds for Lakers vs Warriors?"
- "Show me NFL betting lines for this weekend"
- "Find odds for the next Patriots game"

**Scores & Schedules:**
- "What's the score of the Lakers game?"
- "Show me today's NBA schedule"
- "When does the Chiefs play next?"

**Team Information:**
- "Get the current NBA standings"
- "Show me the Lakers roster"
- "What's the Celtics' schedule this month?"

**News:**
- "Latest NFL news"
- "Show me recent articles about LeBron James"

**Combined Queries:**
- "Give me comprehensive info on the next Lakers game including odds and team stats"

## Available Tools

### The Odds API Tools
- `get_available_sports` - List available sports and their keys
- `get_odds` - Get betting odds for games
- `get_scores` - Get live and recent scores
- `get_event_odds` - Get detailed odds for specific event
- `search_odds` - Natural language search for team odds

### ESPN API Tools
- `get_espn_scoreboard` - Current/scheduled games
- `get_espn_standings` - League standings
- `get_espn_teams` - List teams in a league
- `get_espn_team_details` - Detailed team information
- `get_espn_team_schedule` - Team schedule and results
- `get_espn_news` - Latest news articles
- `search_espn` - Search for teams/players
- `get_espn_game_summary` - Detailed game summary

### Combined Tools
- `get_comprehensive_game_info` - Combines odds and ESPN data

## Building from Source

The project includes a comprehensive PowerShell build script that supports both MCP server and dashboard builds.

### Quick Start

```powershell
# Build MCP package (MCPB)
cd mcp
.\scripts\build\build.ps1 -MCP -VersionBump patch

# Build web dashboard
.\scripts\build\build.ps1 -Dashboard

# Build both
.\scripts\build\build.ps1 -MCP -Dashboard -VersionBump minor
```

### Build Documentation

For complete build documentation, see:
- **[Build Scripts Documentation](scripts/README.md)** - Full reference with all options
- **[Quick Reference](scripts/QUICK_REFERENCE.md)** - Command cheat sheet

### Common Build Commands

```powershell
# MCP builds
.\scripts\build\build.ps1 -MCP -VersionBump patch           # Patch release
.\scripts\build\build.ps1 -MCP -Beta                        # Beta with git hash
.\scripts\build\build.ps1 -MCP -VersionBump minor -Release  # GitHub release

# Dashboard builds
.\scripts\build\build.ps1 -Dashboard                        # Production build
.\scripts\build\build.ps1 -Dashboard -Clean                 # Clean then build

# Maintenance
.\scripts\build\build.ps1 -Clean                            # Clean all artifacts
```

### Build Targets

- **`-MCP`** - Build MCP server package (MCPB format)
  - Output: `mcp/releases/sports-data-mcp-v{version}.mcpb`
  - For Claude Desktop installation

- **`-Dashboard`** - Build web dashboard (React + Node.js)
  - Output: `dashboard/dist/` (backend + frontend)
  - For web server deployment

- **Both** - Use `-MCP -Dashboard` to build everything

### Prerequisites

**For MCP builds:**
- Python 3.11+
- pip

**For dashboard builds:**
- Node.js 20+
- npm 10+

## Configuration

### Environment Variables

- `ODDS_API_KEY` - **(Required)** Your Odds API key
- `BOOKMAKERS_FILTER` - **(Optional)** Comma-separated list of bookmaker keys to include (e.g., `draftkings,fanduel,betmgm`)
  - Filters odds results to only show specified betting sites
  - Leave empty or comment out to include all bookmakers
  - Common bookmaker keys: `draftkings`, `fanduel`, `betmgm`, `caesars`, `barstool`, `pointsbet`, `bet365`, `mybookieag`, `bovada`, `williamhill`
- `BOOKMAKERS_LIMIT` - **(Optional)** Maximum number of bookmakers to show per game (default: 5)
- `LOG_LEVEL` - Logging level (default: INFO)

**Example .env configuration:**
```bash
ODDS_API_KEY=your_api_key_here
BOOKMAKERS_FILTER=draftkings,fanduel,betmgm
BOOKMAKERS_LIMIT=3
LOG_LEVEL=INFO
```

### API Rate Limits

**The Odds API:**
- Free tier: 500 requests/month
- Check remaining quota in response headers

**ESPN API:**
- No authentication required
- Rate limits apply (be respectful)

## Development

### Project Structure

```
sports-odds-mcp/
├── sports_mcp_server.py      # Main MCP server
├── sports_api/               # API handlers
│   ├── odds_api_handler.py   # The Odds API
│   └── espn_api_handler.py   # ESPN API
├── scripts/
│   └── build/
│       └── build.ps1         # Build script
├── manifest.json             # MCP manifest
├── package.json              # Package metadata
├── requirements.txt          # Python dependencies
└── .env.example              # Environment template
```

### Running Tests

```bash
pytest tests/
```

### Code Style

```bash
# Format code
black sports_api/ sports_mcp_server.py

# Lint
pylint sports_api/ sports_mcp_server.py
```

## Troubleshooting

### Common Issues

**"Odds API not configured"**
- Ensure `ODDS_API_KEY` is set in environment or `.env` file
- Verify API key is valid at [the-odds-api.com](https://the-odds-api.com)

**"API returned status 401"**
- Check API key is correct
- Verify key has remaining quota

**"Module not found" errors**
- Ensure all dependencies installed: `pip install -r requirements.txt`
- Check Python version is 3.11+

### Debug Mode

Enable detailed logging:
```bash
export LOG_LEVEL=DEBUG  # Linux/Mac
$env:LOG_LEVEL="DEBUG"  # Windows PowerShell
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

- **The Odds API** - [the-odds-api.com](https://the-odds-api.com)
- **ESPN API** - Unofficial API documentation from community
- **FastMCP** - [Model Context Protocol](https://modelcontextprotocol.io)

## Disclaimer

This project uses:
- The Odds API (official, requires API key)
- ESPN's undocumented public API (unofficial, no authentication)

ESPN API endpoints are community-discovered and may change without notice. This is not an official ESPN product.

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/sports-odds-mcp/issues)
- **Documentation:** [Wiki](https://github.com/yourusername/sports-odds-mcp/wiki)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/sports-odds-mcp/discussions)

---

**Built with ❤️ for Claude Desktop and the MCP community**
