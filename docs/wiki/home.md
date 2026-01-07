# Sports Data MCP - Documentation Wiki

Welcome to the **Sports Data MCP** documentation! This Model Context Protocol (MCP) server provides comprehensive sports data from multiple APIs with natural language query support for Claude Desktop.

## 🎯 Quick Links

- [Installation Guide](Installation-Guide)
- [API Tools Reference](API-Tools-Reference)
- [Usage Examples](Usage-Examples)
- [Configuration Guide](Configuration-Guide)
- [Troubleshooting](Troubleshooting)

## 📊 What is Sports Data MCP?

Sports Data MCP is a powerful MCP server that brings real-time sports data directly into Claude Desktop, enabling natural language queries for:

- **Live betting odds** from multiple bookmakers
- **Live scores** and game results
- **Team information** and standings
- **Schedules** and upcoming games
- **News and articles** from ESPN
- **Historical data** and statistics

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
- **[Installation Guide](Installation-Guide)** - Step-by-step setup instructions
- **[Configuration Guide](Configuration-Guide)** - Environment variables and settings
- **[Usage Examples](Usage-Examples)** - Common queries and use cases

### For Developers
- **[API Tools Reference](API-Tools-Reference)** - Complete tool documentation
- **[Building from Source](Building-from-Source)** - Development setup
- **[Contributing Guide](Contributing-Guide)** - How to contribute

### Reference
- **[Supported Sports List](Supported-Sports)** - All available sports and leagues
- **[Team Reference Tables](Team-Reference)** - NFL/NBA/NHL team IDs and abbreviations
- **[FAQ](FAQ)** - Frequently asked questions
- **[Troubleshooting](Troubleshooting)** - Common issues and solutions

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
- **Bugs?** Report on [GitHub Issues](https://github.com/WFord26/Sports-Odds-MCP/issues)

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/WFord26/Sports-Odds-MCP/blob/main/LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! See the [Contributing Guide](Contributing-Guide) for details.

---

**Version:** 0.1.10  
**Author:** William Ford  
**Repository:** [github.com/WFord26/Sports-Odds-MCP](https://github.com/WFord26/Sports-Odds-MCP)
