# Installation Guide

This guide will walk you through installing Sports Data MCP for use with Claude Desktop.

## Prerequisites

- **Python 3.11 or higher** - [Download Python](https://www.python.org/downloads/)
- **Claude Desktop** - [Download Claude Desktop](https://claude.ai/download)
- **The Odds API Key** (optional but recommended) - [Get free API key](https://the-odds-api.com)

## Installation Methods

### Method 1: MCPB Package (Recommended)

This is the easiest method for most users.

#### Step 1: Download Package

1. Go to the [Releases page](https://github.com/WFord26/Sports-Odds-MCP/releases)
2. Download the latest `.mcpb` file (e.g., `sports-data-mcp-v0.1.10.mcpb`)

#### Step 2: Install in Claude Desktop

1. Open **Claude Desktop**
2. Go to **Settings** → **Developer**
3. Click **"Install MCP Package"**
4. Select the downloaded `.mcpb` file
5. Wait for installation to complete

#### Step 3: Configure API Key

1. Locate your installation directory:
   - **Windows**: `%APPDATA%\Claude\sports-mcp-config\`
   - **macOS**: `~/Library/Application Support/Claude/sports-mcp-config/`
   - **Linux**: `~/.config/Claude/sports-mcp-config/`

2. Edit the `.env` file:
   ```bash
   ODDS_API_KEY=your_api_key_here
   ```

3. Restart Claude Desktop

#### Step 4: Verify Installation

Ask Claude: `"What sports data tools are available?"`

If successful, Claude will list the Sports Data MCP tools.

---

### Method 2: Manual Installation

For developers or users who want more control.

#### Step 1: Clone Repository

```bash
git clone https://github.com/WFord26/Sports-Odds-MCP.git
cd Sports-Odds-MCP
```

#### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

#### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your preferred editor
```

Add:
```bash
ODDS_API_KEY=your_api_key_here
```

#### Step 4: Configure Claude Desktop

Edit your Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the server configuration:

```json
{
  "mcpServers": {
    "sports-data": {
      "command": "python",
      "args": ["C:/path/to/Sports-Odds-MCP/sports_mcp_server.py"],
      "env": {
        "ODDS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Note**: Use absolute paths and forward slashes even on Windows.

#### Step 5: Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

---

## Getting Your Odds API Key

### Free Tier (Recommended for Testing)

1. Visit [the-odds-api.com](https://the-odds-api.com)
2. Click **"Get API Key"**
3. Sign up with your email
4. Verify your email
5. Copy your API key from the dashboard

### Free Tier Limits
- **500 requests per month**
- Access to all sports
- All betting markets
- Perfect for personal use

### Paid Tiers
If you need more requests, check [their pricing page](https://the-odds-api.com/pricing) for paid plans starting at $25/month.

---

## Verifying Installation

### Test 1: List Available Tools

Ask Claude:
```
What sports data tools do you have?
```

Expected response: Claude should list tools like `get_odds`, `get_scores`, `get_espn_scoreboard`, etc.

### Test 2: Test Odds API

Ask Claude:
```
Get available sports from The Odds API
```

Expected response: A list of sports with their keys (e.g., `americanfootball_nfl`, `basketball_nba`)

### Test 3: Test ESPN API

Ask Claude:
```
Show me today's NBA scores
```

Expected response: Current NBA games with scores (no API key needed)

---

## Troubleshooting Installation

### Issue: MCP Server Not Loading

**Symptom**: Claude doesn't recognize sports data tools

**Solutions**:
1. Restart Claude Desktop completely
2. Check the config file path is correct
3. Verify Python path is absolute
4. Check Python version: `python --version` (must be 3.11+)

### Issue: "Odds API not configured" Error

**Symptom**: Error when using odds-related tools

**Solutions**:
1. Verify `.env` file exists in config directory
2. Check API key is correct (no extra spaces)
3. Ensure environment variable is loaded
4. Restart Claude Desktop after changing `.env`

### Issue: Module Import Errors

**Symptom**: `ModuleNotFoundError` in logs

**Solutions**:
1. Reinstall dependencies: `pip install -r requirements.txt`
2. Use virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
3. Update config to use venv Python path

### Issue: Rate Limit Errors

**Symptom**: "Rate limit exceeded" errors

**Solutions**:
1. You've used all 500 free API calls
2. Wait until next month or upgrade to paid plan
3. ESPN tools still work without Odds API

---

## Updating Sports Data MCP

### MCPB Package Method

1. Download the new `.mcpb` package
2. Uninstall old version in Claude Desktop
3. Install new version
4. Your `.env` file is preserved automatically

### Manual Installation Method

```bash
cd Sports-Odds-MCP
git pull
pip install -r requirements.txt --upgrade
```

Restart Claude Desktop.

---

## Uninstalling

### MCPB Package Method

1. Open Claude Desktop
2. Go to **Settings** → **Developer**
3. Find Sports Data MCP in installed packages
4. Click **"Uninstall"**

### Manual Installation Method

1. Remove the MCP server entry from `claude_desktop_config.json`
2. Delete the Sports-Odds-MCP directory
3. Restart Claude Desktop

---

## Next Steps

- **[Usage Examples](Usage-Examples)** - Learn how to query sports data
- **[API Tools Reference](API-Tools-Reference)** - Complete tool documentation
- **[Configuration Guide](Configuration-Guide)** - Advanced settings

---

**Need Help?** Check the [Troubleshooting](Troubleshooting) page or [open an issue](https://github.com/WFord26/Sports-Odds-MCP/issues).
