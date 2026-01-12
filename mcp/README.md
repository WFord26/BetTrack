<div align="center">

![BetTrack MCP Logo](../assets/logo-mcp.png)

# BetTrack MCP Server

**Sports data and betting odds for Claude Desktop via Model Context Protocol**

</div>

---

## Overview

The BetTrack MCP Server provides Claude Desktop with direct access to live sports data, betting odds, and comprehensive analytics through 30+ natural language tools. Query games, track odds, analyze matchups, and get player props across 7+ major sports—all conversationally through Claude.

## Quick Install

1. **Download** the latest `.mcpb` package from [Releases](https://github.com/yourusername/BetTrack/releases)
2. **Install** via Claude Desktop → Settings → Developer → Install MCP Package
3. **Configure** your API key (see [Installation Guide](INSTALL_INSTRUCTIONS.md))

## Key Features

- **30+ Sports Data Tools** - Live odds, scores, schedules, standings, news
- **70+ Betting Markets** - Game lines, spreads, totals, player props (NFL/NBA/NHL/MLB)
- **Natural Language Search** - Find teams, matchups, and odds conversationally
- **Visual Scoreboards** - Interactive React artifacts with live scores
- **Multiple Data Sources** - The Odds API (betting) + ESPN API (sports data)

## Example Queries

```
"What are the odds for the Lakers game tonight?"
"Show me NFL betting lines for this weekend"
"Get player prop odds for Patrick Mahomes passing yards"
"Display a visual scoreboard for today's NBA games"
"What's the current NBA standings?"
```

## Documentation

- 📖 **[Installation Instructions](INSTALL_INSTRUCTIONS.md)** - Detailed setup guide
- 🛠️ **[Available Tools](../docs/AVAILABLE-TOOLS.md)** - Complete tool reference
- 📚 **[Wiki](https://github.com/yourusername/BetTrack/wiki)** - Technical documentation
- 🔧 **[Build Instructions](../scripts/README.md)** - Building from source

## Requirements

- Python 3.11+
- Claude Desktop
- The Odds API key ([free tier available](https://the-odds-api.com))

## Configuration

Set your API key via environment variable or `.env` file:

```bash
ODDS_API_KEY=your_api_key_here
```

Optional filters to reduce API quota usage:

```bash
BOOKMAKERS_FILTER=draftkings,fanduel,betmgm
BOOKMAKERS_LIMIT=3
```

## Supported Sports

🏈 NFL • 🏀 NBA • 🏀 NCAAB • 🏒 NHL • ⚾ MLB • ⚽ EPL • ⚽ UEFA Champions League • And more...

## Building & Development

```powershell
# Build MCPB package
cd ../scripts
.\build.ps1 -VersionBump patch

# Run server locally
cd ../mcp
python sports_mcp_server.py
```

For complete build documentation, see [Build Scripts](../scripts/README.md).

---

<div align="center">

**Part of the [BetTrack Sports Betting Platform](../README.md)**

[Root README](../README.md) · [Dashboard](../dashboard/README.md) · [Documentation](../docs/) · [Wiki](https://github.com/yourusername/BetTrack/wiki)

</div>
