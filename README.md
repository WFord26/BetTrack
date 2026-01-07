# Sports Data MCP

Model Context Protocol (MCP) server providing comprehensive sports data from multiple APIs with natural language query support for Claude Desktop.

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
         "args": ["C:/path/to/sports-odds-mcp/sports_mcp_server.py"],
         "env": {
           "ODDS_API_KEY": "your_api_key_here"
         }
       }
     }
   }
   ```

## Usage

Once installed, you can query sports data using natural language in Claude Desktop:

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

### Build MCPB Package

```powershell
# Patch version bump
.\scripts\build\build.ps1 -VersionBump patch

# Minor version bump with GitHub release
.\scripts\build\build.ps1 -VersionBump minor -Release

# Clean build artifacts
.\scripts\build\build.ps1 -Clean
```

### Build Options

- `-VersionBump` - Bump version (major/minor/patch)
- `-Release` - Create GitHub release
- `-Clean` - Clean build artifacts

## Configuration

### Environment Variables

- `ODDS_API_KEY` - **(Required)** Your Odds API key
- `LOG_LEVEL` - Logging level (default: INFO)

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
