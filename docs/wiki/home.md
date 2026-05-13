<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/assets/logo.png" alt="BetTrack Logo" width="200"/>
</div>

# BetTrack - Documentation Wiki

Welcome to the **BetTrack** documentation! Complete sports betting data platform combining MCP server for Claude Desktop with optional web dashboard for bet tracking and line movement analysis.

## 🚀 Quick Links

- **[Quick Start Guide](Quick-Start.md)** - Get up and running in 5 minutes
- **[Getting API Key](Getting-API-Key.md)** - Obtain your free Odds API key
- **[Installation Guide](Installation-Guide.md)** - Detailed installation instructions
- **[API Documentation](API-DOCUMENTATION.md)** - Complete API reference

## � Screenshots

### Dashboard Home Page
<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/docs/assets/home-page.png" alt="BetTrack Home Page" width="800"/>
  <p><em>Landing page with feature overview and quick start guide</em></p>
</div>

### Dashboard V2 - Dark Mode
<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/docs/assets/dashboard-dark.png" alt="Dashboard V2 Dark Mode" width="800"/>
  <p><em>Enhanced dashboard with live odds, game cards, and bet slip in dark mode</em></p>
</div>

### Dashboard V2 - Light Mode
<div align="center">
  <img src="https://raw.githubusercontent.com/WFord26/BetTrack/main/docs/assets/dashboard-light.png" alt="Dashboard V2 Light Mode" width="800"/>
  <p><em>Clean light mode interface with filtering sidebar and responsive layout</em></p>
</div>

## �📚 Component Guides

- **[MCP Server Guide](MCP-Server-Guide.md)** - Architecture, tools, and development
- **[Dashboard Guide](Dashboard-Guide.md)** - Full-stack React app for bet tracking
- **[Backend Guide](Backend-Guide.md)** - Node.js backend architecture
- **[Frontend Guide](Frontend-Guide.md)** - React dashboard components
- **[Database Guide](Database-Guide.md)** - Schema, migrations, and queries

## 📊 What is BetTrack?

BetTrack is a dual-platform sports betting data system:

### 🤖 MCP Server (Claude Desktop)
Natural language queries for sports data:
- **Live betting odds** from 10+ bookmakers
- **Real-time scores** and game results
- **Team stats** and standings
- **Player props** (70+ markets)
- **Line movement** tracking
- **ESPN integration** (schedules, news, rosters)

### 🌐 Web Dashboard (Optional)
Full-featured bet tracking platform:
- **Bet slip management** with Redux state
- **Line movement charts** with Recharts
- **Bet history** and performance tracking
- **Automated outcomes** resolution
- **Multi-sport support** (NFL, NBA, NHL, MLB, Soccer)
- **Background jobs** for odds syncing

## 🔌 Data Sources

### The Odds API
- Current and upcoming game odds
- Multiple betting markets (moneyline, spreads, totals)
- Live score tracking
- Natural language team/matchup search
- **Free tier available** at [the-odds-api.com](https://the-odds-api.com)

### ESPN API
- Live scoreboards with real-time updates
- Team details, rosters, and logos
- League standings and rankings
- Game schedules and results
- Sports news and articles
- Player information
- No API key required

## 🏆 Supported Sports

| Sport | Odds API | ESPN API | Team Logos |
|-------|----------|----------|------------|
| **NFL** - American Football | ✅ | ✅ | ✅ |
| **NBA** - Basketball | ✅ | ✅ | ✅ |
| **NHL** - Hockey | ✅ | ✅ | ✅ |
| **MLB** - Baseball | ✅ | ✅ | ⚠️ |
| **College Football** | ✅ | ✅ | ⚠️ |
| **College Basketball** | ✅ | ✅ | ⚠️ |
| **Soccer** (Multiple leagues) | ✅ | ✅ | ⚠️ |

✅ Full support | ⚠️ Partial support

## 🚀 Getting Started

### 1. Installation
```bash
# Download the latest .mcpb package from Releases
# Install via Claude Desktop: Settings → Developer → Install MCP Package
```

### 2. Configuration
```bash
# Create .env file with your Odds API key
ODDS_API_KEY=your_api_key_here
```

### 3. Start Using
Ask Claude natural language questions:
- "What are the current odds for Lakers vs Warriors?"
- "Show me today's NFL schedule"
- "Get the NBA standings"

## 📚 Documentation Sections

### For New Users
- **[Quick Start](Quick-Start.md)** - Get running in 5 minutes
- **[Installation Guide](Installation-Guide.md)** - Step-by-step setup instructions
- **[Configuration Reference](Configuration-Reference.md)** - All environment variables
- **[Getting API Key](Getting-API-Key.md)** - Detailed API key setup

### For Developers
- **[API Documentation](API-DOCUMENTATION.md)** - Complete MCP tool reference
- **[Backend Guide](Backend-Guide.md)** - Node.js backend development
- **[Frontend Guide](Frontend-Guide.md)** - React dashboard development
- **[Database Guide](Database-Guide.md)** - Schema and migrations

### Reference & Troubleshooting
- **[Troubleshooting](Troubleshooting.md)** - Common issues and solutions
- **[Developer Guide](Developer-Guide.md)** - Contributing and code standards
- **[MCP Server Guide](MCP-Server-Guide.md)** - MCP architecture and development

## 🎨 Output Formats

Sports Data MCP provides multiple output formats:

### ASCII Art Cards
Beautiful, instant-display matchup cards with team info, odds, and broadcast details:
```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                            MATCHUP                             │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│              Los Angeles Lakers  vs  Boston Celtics            │
│                                                                │
│                          110  -  105                           │
│                                                                │
│                   Wed, Jan 08 @ 07:30 PM                       │
│                                                                │
│                         📺 ESPN, TNT                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Formatted Tables
Clean, structured data in table format for easy reading:
- Scoreboards with live scores
- League standings
- Odds comparison across bookmakers

### Structured JSON
Complete data for integration with other tools and services.

## 🔧 Key Features

### Natural Language Search
No need to know sport keys or team IDs - just ask:
- "Find odds for the next Patriots game"
- "Lakers game today"
- "NFL scores"

### Multiple Bookmakers
Compare odds from:
- DraftKings
- FanDuel
- BetMGM
- Bovada
- BetOnline
- And more...

### Real-Time Data
- Live game scores
- Up-to-date betting lines
- Current standings
- Latest news

### Team Logos
High-resolution team logos from ESPN CDN (500px PNGs) for all NFL, NBA, and NHL teams.

## 📖 Tool Categories

### Odds & Betting Tools (6 tools)
- Get available sports
- Get odds for games
- Get live scores
- Search by team name
- Compare bookmaker odds
- Get event-specific odds

### ESPN Tools (8+ tools)
- Scoreboards
- Team information
- League standings
- Game schedules
- News and articles
- Player data
- Game summaries

### Formatted Output Tools (7 tools)
- Matchup cards with ASCII art
- Formatted scoreboards
- Standings tables
- Odds comparison tables
- Team reference lookup

## 🆘 Need Help?

- **Issues?** Check the [Troubleshooting](Troubleshooting) guide
- **Questions?** See the [FAQ](FAQ)
- **Bugs?** Report on [GitHub Issues](https://github.com/WFord26/BetTrack/issues)

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/WFord26/BetTrack/blob/main/LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! See the [Contributing Guide](Contributing-Guide) for details.

---

**Version:** 0.1.10  
**Author:** William Ford  
**Repository:** [github.com/WFord26/BetTrack](https://github.com/WFord26/BetTrack)
