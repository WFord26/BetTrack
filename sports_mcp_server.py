#!/usr/bin/env python3
"""
Sports Data MCP Server
=====================
Model Context Protocol server providing access to sports data from:
- The Odds API (betting odds, scores, events)
- ESPN API (teams, schedules, players, news)

Supports natural language queries for sports information.
"""

import os
import sys
import logging
from typing import Optional
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from mcp.server import FastMCP

# Import API handlers
from sports_api.odds_api_handler import OddsAPIHandler
from sports_api.espn_api_handler import ESPNAPIHandler
from sports_api.formatter import (
    format_matchup_card,
    format_scoreboard_table,
    format_detailed_scoreboard,
    format_standings_table,
    format_odds_comparison
)
from sports_api.team_reference import (
    get_team_reference_table,
    find_team_id,
    get_team_logo_url,
    NFL_TEAMS,
    NBA_TEAMS,
    NHL_TEAMS
)

# Load environment variables from persistent config directory (survives updates)
# Check for user-specified config directory (set via manifest.json)
config_dir_env = os.getenv("SPORTS_MCP_CONFIG_DIR")
if config_dir_env:
    config_dir = Path(os.path.expandvars(config_dir_env))
else:
    # Fall back to script directory (for development/standalone)
    config_dir = Path(__file__).parent.absolute()

# Create config directory if it doesn't exist
config_dir.mkdir(parents=True, exist_ok=True)

env_path = config_dir / ".env"
script_dir = Path(__file__).parent.absolute()
env_example_path = script_dir / ".env.example"

# If .env doesn't exist, create from template (first install only)
if not env_path.exists() and env_example_path.exists():
    import shutil
    shutil.copy(env_example_path, env_path)
    print(f"\n{'='*60}")
    print(f"First-time setup: Created configuration file")
    print(f"Location: {env_path}")
    print(f"")
    print(f"IMPORTANT: Edit this file and add your ODDS_API_KEY")
    print(f"Get your API key from: https://the-odds-api.com")
    print(f"{'='*60}\n")

if env_path.exists():
    load_dotenv(env_path)
    logger_temp = logging.getLogger(__name__)
    logger_temp.info(f"Loaded .env from persistent config: {env_path}")
else:
    # Fall back to current directory
    load_dotenv()
    logger_temp = logging.getLogger(__name__)
    logger_temp.info("Loaded .env from current directory or environment")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP(
    "Sports Data MCP",
    dependencies=["aiohttp", "python-dotenv"]
)

# Initialize API handlers
odds_api_key = os.getenv("ODDS_API_KEY")
if not odds_api_key:
    logger.warning("ODDS_API_KEY not found. Odds API tools will not be available.")

odds_handler = OddsAPIHandler(api_key=odds_api_key) if odds_api_key else None
espn_handler = ESPNAPIHandler()


# ============================================================================
# THE ODDS API TOOLS
# ============================================================================

@mcp.tool()
async def get_available_sports(all_sports: bool = False) -> dict:
    """
    Get list of available sports from The Odds API.
    
    Args:
        all_sports: If False (default), returns only in-season sports. If True, returns all sports.
    
    Returns:
        Dictionary with list of sports and their details (key, title, group, active status)
    
    Example:
        get_available_sports() -> Returns currently in-season sports
        get_available_sports(True) -> Returns all available sports
    """
    if not odds_handler:
        return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}
    
    return await odds_handler.get_sports(all_sports=all_sports)


@mcp.tool()
async def get_odds(
    sport: str,
    regions: str = "us",
    markets: Optional[str] = None,
    odds_format: str = "american",
    date_format: str = "iso"
) -> dict:
    """
    Get current betting odds for upcoming games in a specific sport.
    
    Args:
        sport: Sport key (e.g., 'americanfootball_nfl', 'basketball_nba', 'icehockey_nhl')
        regions: Comma-separated bookmaker regions: us, us2, uk, au, eu (default: us)
        markets: Comma-separated markets: h2h (moneyline), spreads, totals (default: h2h)
        odds_format: american, decimal, or fractional (default: american)
        date_format: iso or unix (default: iso)
    
    Returns:
        Dictionary with games and their odds from multiple bookmakers
    
    Example:
        get_odds("americanfootball_nfl") -> NFL odds from US bookmakers
        get_odds("basketball_nba", regions="us,uk", markets="h2h,spreads") -> NBA moneyline and spreads
    """
    if not odds_handler:
        return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}
    
    return await odds_handler.get_odds(
        sport=sport,
        regions=regions,
        markets=markets,
        odds_format=odds_format,
        date_format=date_format
    )


@mcp.tool()
async def get_scores(sport: str, days_from: int = 3) -> dict:
    """
    Get scores for recent, live, and upcoming games.
    
    Args:
        sport: Sport key (e.g., 'americanfootball_nfl', 'basketball_nba')
        days_from: Number of days from today to include (default: 3, max: 3)
    
    Returns:
        Dictionary with game scores and status
    
    Example:
        get_scores("basketball_nba") -> NBA scores from past 3 days
    """
    if not odds_handler:
        return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}
    
    return await odds_handler.get_scores(sport=sport, days_from=days_from)


@mcp.tool()
async def get_event_odds(
    sport: str,
    event_id: str,
    regions: str = "us",
    markets: Optional[str] = None,
    odds_format: str = "american"
) -> dict:
    """
    Get detailed odds for a specific game/event.
    
    Args:
        sport: Sport key
        event_id: Event ID from get_odds() or get_scores()
        regions: Comma-separated bookmaker regions (default: us)
        markets: Comma-separated markets (default: h2h)
        odds_format: american, decimal, or fractional (default: american)
    
    Returns:
        Dictionary with detailed odds for the specific event
    
    Example:
        get_event_odds("basketball_nba", "abc123xyz") -> Detailed odds for specific NBA game
    """
    if not odds_handler:
        return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}
    
    return await odds_handler.get_event_odds(
        sport=sport,
        event_id=event_id,
        regions=regions,
        markets=markets,
        odds_format=odds_format
    )


@mcp.tool()
async def search_odds(
    query: str,
    sport: Optional[str] = None,
    regions: str = "us",
    markets: str = "h2h"
) -> dict:
    """
    Natural language search for betting odds on specific teams or matchups.
    
    Args:
        query: Natural language query (e.g., "Lakers odds", "Patriots vs Bills")
        sport: Optional sport filter (e.g., 'basketball_nba', 'americanfootball_nfl')
        regions: Bookmaker regions (default: us)
        markets: Markets to include (default: h2h)
    
    Returns:
        Dictionary with matching games and their odds
    
    Example:
        search_odds("Lakers") -> Finds Lakers games with odds
        search_odds("Chiefs vs Bills", "americanfootball_nfl") -> Specific NFL matchup odds
    """
    if not odds_handler:
        return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}
    
    return await odds_handler.search_odds(
        query=query,
        sport=sport,
        regions=regions,
        markets=markets
    )


# ============================================================================
# ESPN API TOOLS
# ============================================================================

@mcp.tool()
async def get_espn_scoreboard(
    sport: str,
    league: str,
    date: Optional[str] = None,
    limit: int = 10
) -> dict:
    """
    Get current/scheduled games from ESPN scoreboard with CONCISE output.
    Returns only essential game info to avoid message length limits.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, college-football, mens-college-basketball, etc.)
        date: Optional date in YYYYMMDD format (default: today)
        limit: Maximum number of games to return (default: 10, max: 25)
    
    Returns:
        Dictionary with streamlined scoreboard data (scores, teams, status only)
    
    Example:
        get_espn_scoreboard("football", "nfl") -> Current NFL scoreboard
        get_espn_scoreboard("basketball", "nba", "20260210") -> NBA games on Feb 10, 2026
    
    Note: Use get_formatted_scoreboard() for better visual output
    """
    # Cap limit to prevent data overflow
    limit = min(limit, 25)
    
    result = await espn_handler.get_scoreboard(
        sport=sport,
        league=league,
        date=date,
        limit=limit
    )
    
    if not result.get("success"):
        return result
    
    # Extract only essential data from ESPN response
    full_data = result.get("data", {})
    events = full_data.get("events", [])
    
    streamlined_games = []
    for event in events[:limit]:
        competitions = event.get("competitions", [{}])
        if not competitions:
            continue
            
        comp = competitions[0]
        competitors = comp.get("competitors", [])
        
        # Extract team info and scores
        home_team = next((c for c in competitors if c.get("homeAway") == "home"), {})
        away_team = next((c for c in competitors if c.get("homeAway") == "away"), {})
        
        game = {
            "id": event.get("id"),
            "name": event.get("name"),
            "date": event.get("date"),
            "status": comp.get("status", {}).get("type", {}).get("description", "Scheduled"),
            "completed": comp.get("status", {}).get("type", {}).get("completed", False),
            "home_team": {
                "name": home_team.get("team", {}).get("displayName", ""),
                "abbreviation": home_team.get("team", {}).get("abbreviation", ""),
                "score": home_team.get("score", "0"),
                "record": home_team.get("records", [{}])[0].get("summary", "") if home_team.get("records") else ""
            },
            "away_team": {
                "name": away_team.get("team", {}).get("displayName", ""),
                "abbreviation": away_team.get("team", {}).get("abbreviation", ""),
                "score": away_team.get("score", "0"),
                "record": away_team.get("records", [{}])[0].get("summary", "") if away_team.get("records") else ""
            }
        }
        
        # Add broadcast info if available
        broadcasts = comp.get("broadcasts", [])
        if broadcasts:
            game["broadcast"] = broadcasts[0].get("names", [""])[0]
        
        streamlined_games.append(game)
    
    return {
        "success": True,
        "games": streamlined_games,
        "total_games": len(streamlined_games),
        "league": full_data.get("leagues", [{}])[0].get("name", league.upper()),
        "note": "Streamlined output - use get_formatted_scoreboard() for visual table format"
    }


@mcp.tool()
async def get_espn_standings(sport: str, league: str, season: Optional[int] = None) -> dict:
    """
    Get league standings from ESPN.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        season: Optional season year (default: current season)
    
    Returns:
        Dictionary with standings data
    
    Example:
        get_espn_standings("basketball", "nba") -> Current NBA standings
        get_espn_standings("football", "nfl", 2025) -> 2025 NFL standings
    """
    return await espn_handler.get_standings(
        sport=sport,
        league=league,
        season=season
    )


@mcp.tool()
async def get_espn_teams(sport: str, league: str) -> dict:
    """
    Get CONCISE list of teams for a specific league.
    Returns only essential team info to avoid message overflow.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
    
    Returns:
        Dictionary with streamlined team list (name, id, abbreviation only)
    
    Example:
        get_espn_teams("football", "nfl") -> List of NFL teams
        get_espn_teams("basketball", "nba") -> List of NBA teams
    
    Note: Use get_team_reference() for formatted tables
    """
    result = await espn_handler.get_teams(sport=sport, league=league)
    
    if not result.get("success"):
        return result
    
    # Extract only essential team data
    full_data = result.get("data", {})
    sports_data = full_data.get("sports", [{}])[0]
    leagues_data = sports_data.get("leagues", [{}])[0]
    teams_data = leagues_data.get("teams", [])
    
    streamlined_teams = []
    for team_obj in teams_data:
        team = team_obj.get("team", {})
        streamlined_teams.append({
            "id": team.get("id"),
            "name": team.get("displayName"),
            "abbreviation": team.get("abbreviation"),
            "location": team.get("location"),
            "color": team.get("color"),
            "logo": team.get("logos", [{}])[0].get("href") if team.get("logos") else None
        })
    
    return {
        "success": True,
        "teams": streamlined_teams,
        "total": len(streamlined_teams),
        "league": leagues_data.get("name", league.upper()),
        "note": "Streamlined output - use get_espn_team_details() for full team info"
    }


@mcp.tool()
async def get_espn_team_details(
    sport: str,
    league: str,
    team_id: str,
    include_roster: bool = False
) -> dict:
    """
    Get detailed information about a specific team.
    WARNING: Returns large amounts of data. May exceed message limits.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        team_id: Team ID
        include_roster: Whether to include team roster (default: False, AVOID TRUE)
    
    Returns:
        Dictionary with team details and stats (VERBOSE)
    
    Example:
        get_espn_team_details("basketball", "nba", "17") -> Lakers details
    
    Note: Prefer get_espn_teams() for basic team info
    """
    return await espn_handler.get_team_details(
        sport=sport,
        league=league,
        team_id=team_id,
        include_roster=include_roster
    )


@mcp.tool()
async def get_espn_team_schedule(
    sport: str,
    league: str,
    team_id: str,
    season: Optional[int] = None,
    limit: int = 20
) -> dict:
    """
    Get team schedule and results (compact format).
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        team_id: Team ID
        season: Optional season year (default: current season)
        limit: Maximum number of games to return (default: 20)
    
    Returns:
        Dictionary with condensed schedule data (reduces response size)
    
    Example:
        get_espn_team_schedule("basketball", "nba", "17") -> Lakers schedule (20 games)
        get_espn_team_schedule("football", "nfl", "12", limit=10) -> Chiefs last 10 games
    """
    result = await espn_handler.get_team_schedule(
        sport=sport,
        league=league,
        team_id=team_id,
        season=season
    )
    
    # Reduce response size by extracting only essential data
    if result.get("success") and result.get("data"):
        events = result["data"].get("events", [])
        
        # Create condensed schedule with only essential fields
        condensed_schedule = []
        for event in events[:limit]:
            game = {
                "id": event.get("id"),
                "date": event.get("date"),
                "name": event.get("name"),
                "shortName": event.get("shortName")
            }
            
            if "competitions" in event and len(event["competitions"]) > 0:
                comp = event["competitions"][0]
                game["status"] = comp.get("status", {}).get("type", {}).get("description", "TBD")
                
                # Get scores
                competitors = comp.get("competitors", [])
                if len(competitors) >= 2:
                    for c in competitors:
                        team_name = c.get("team", {}).get("displayName", "")
                        score = c.get("score", "")
                        is_home = c.get("homeAway") == "home"
                        
                        if is_home:
                            game["home_team"] = team_name
                            game["home_score"] = score
                        else:
                            game["away_team"] = team_name
                            game["away_score"] = score
                        
                        # Check if this is the target team
                        if c.get("team", {}).get("id") == team_id:
                            game["result"] = "W" if c.get("winner") else "L" if score else "TBD"
            
            condensed_schedule.append(game)
        
        return {
            "success": True,
            "data": {
                "team_id": team_id,
                "games": condensed_schedule,
                "game_count": len(condensed_schedule),
                "total_games": len(events)
            }
        }
    
    return result


@mcp.tool()
async def get_espn_news(
    sport: str,
    league: str,
    limit: int = 20
) -> dict:
    """
    Get latest news articles for a sport/league.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        limit: Maximum number of articles (default: 20)
    
    Returns:
        Dictionary with news articles
    
    Example:
        get_espn_news("football", "nfl") -> Latest NFL news
        get_espn_news("basketball", "nba", 10) -> Top 10 NBA news articles
    """
    return await espn_handler.get_news(
        sport=sport,
        league=league,
        limit=limit
    )


@mcp.tool()
async def search_espn(query: str, limit: int = 10) -> dict:
    """
    Search ESPN for teams, players, or content.
    
    Args:
        query: Search query (team name, player name, etc.)
        limit: Maximum number of results (default: 10)
    
    Returns:
        Dictionary with search results
    
    Example:
        search_espn("LeBron James") -> Search for LeBron James
        search_espn("Lakers") -> Search for Lakers team/content
    """
    return await espn_handler.search(query=query, limit=limit)


@mcp.tool()
async def get_espn_game_summary(sport: str, league: str, event_id: str) -> dict:
    """
    Get detailed game summary with box score and play-by-play.
    WARNING: Returns MASSIVE amounts of data. Will likely exceed message limits.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        event_id: Game/Event ID
    
    Returns:
        Dictionary with detailed game summary (EXTREMELY VERBOSE)
    
    Example:
        get_espn_game_summary("basketball", "nba", "401584920") -> NBA game summary
    
    Note: Use get_espn_scoreboard() for basic game info instead
    """
    return await espn_handler.get_game_summary(
        sport=sport,
        league=league,
        event_id=event_id
    )


# ============================================================================
# COMBINED/UTILITY TOOLS
# ============================================================================

@mcp.tool()
async def get_comprehensive_game_info(
    sport_key: str,
    league: str,
    team_query: str
) -> dict:
    """
    Get comprehensive game information combining odds and ESPN data.
    
    Args:
        sport_key: Odds API sport key (e.g., 'americanfootball_nfl')
        league: ESPN league code (e.g., 'nfl')
        team_query: Team name or query to search for
    
    Returns:
        Dictionary combining betting odds and ESPN game data
    
    Example:
        get_comprehensive_game_info("basketball_nba", "nba", "Lakers") -> Combined Lakers data
    """
    result = {
        "team_query": team_query,
        "odds_data": None,
        "espn_data": None,
        "error": None
    }
    
    # Get odds if available
    if odds_handler:
        try:
            odds_result = await odds_handler.search_odds(query=team_query, sport=sport_key)
            result["odds_data"] = odds_result
        except Exception as e:
            result["error"] = f"Odds API error: {str(e)}"
    
    # Get ESPN scoreboard
    try:
        sport_type = sport_key.split('_')[0]  # Extract sport type from key
        if sport_type == "americanfootball":
            sport_type = "football"
        elif sport_type == "icehockey":
            sport_type = "hockey"
        
        espn_result = await espn_handler.get_scoreboard(sport=sport_type, league=league)
        result["espn_data"] = espn_result
    except Exception as e:
        if result["error"]:
            result["error"] += f"; ESPN API error: {str(e)}"
        else:
            result["error"] = f"ESPN API error: {str(e)}"
    
    return result


# ============================================================================
# FORMATTED OUTPUT TOOLS
# ============================================================================

@mcp.tool()
async def get_formatted_scoreboard(
    sport: str,
    league: str,
    date: Optional[str] = None
) -> dict:
    """
    Get scoreboard with formatted table output (concise ESPN data).
    
    Args:
        sport: Sport type (football, basketball, hockey)
        league: League code (nfl, nba, nhl)
        date: Optional date in YYYYMMDD format
    
    Returns:
        Dictionary with formatted scoreboard table
    
    Example:
        get_formatted_scoreboard("basketball", "nba") -> NBA games in table format
    """
    result = await espn_handler.get_scoreboard(sport=sport, league=league, date=date, limit=15)
    
    if result.get("success") and result.get("data"):
        games = result["data"].get("events", [])
        formatted_table = format_scoreboard_table(games)
        
        return {
            "success": True,
            "formatted_output": formatted_table,
            "game_count": len(games)
        }
    
    return result


@mcp.tool()
async def get_matchup_cards(
    sport_key: str,
    team_query: Optional[str] = None,
    regions: str = "us",
    include_broadcasts: bool = True
) -> dict:
    """
    Get matchup cards with odds and TV info (formatted like ESPN matchup display).
    
    Args:
        sport_key: Odds API sport key (e.g., 'basketball_nba', 'americanfootball_nfl')
        team_query: Optional team name to filter
        regions: Bookmaker regions (default: us)
        include_broadcasts: Merge ESPN broadcast data if True (default: True)
    
    Returns:
        Dictionary with formatted matchup cards including TV channels
    
    Example:
        get_matchup_cards("basketball_nba", "Lakers") -> Lakers matchup with odds and TV
    """
    if not odds_handler:
        return {"error": "Odds API not configured"}
    
    if team_query:
        result = await odds_handler.search_odds(query=team_query, sport=sport_key, regions=regions)
        games = result.get("matching_games", [])
    else:
        result = await odds_handler.get_odds(sport=sport_key, regions=regions, markets="h2h")
        games = result.get("data", []) if result.get("success") else []
    
    # Merge ESPN broadcast data if requested
    if games and include_broadcasts:
        # Map sport_key to ESPN sport/league
        sport_map = {
            'basketball_nba': ('basketball', 'nba'),
            'americanfootball_nfl': ('football', 'nfl'),
            'icehockey_nhl': ('hockey', 'nhl')
        }
        
        if sport_key in sport_map:
            sport, league = sport_map[sport_key]
            espn_result = await espn_handler.get_scoreboard(sport=sport, league=league, limit=50)
            
            if espn_result.get("success") and espn_result.get("data"):
                espn_events = espn_result["data"].get("events", [])
                
                # Merge broadcast data by matching team names
                for game in games:
                    home = game.get('home_team', '')
                    away = game.get('away_team', '')
                    
                    for event in espn_events:
                        if 'competitions' in event:
                            comp = event['competitions'][0]
                            competitors = comp.get('competitors', [])
                            
                            # Match teams
                            espn_teams = [c.get('team', {}).get('displayName', '') for c in competitors]
                            if home in espn_teams or away in espn_teams:
                                # Add broadcast info to odds game
                                game['broadcasts'] = comp.get('broadcasts', [])
                                break
    
    if games:
        cards = [format_matchup_card(game) for game in games[:5]]
        return {
            "success": True,
            "matchup_cards": cards,
            "count": len(cards)
        }
    
    return {"success": False, "message": "No games found"}


@mcp.tool()
async def get_detailed_scoreboard(
    sport: str,
    league: str,
    date: Optional[str] = None
) -> dict:
    """
    Get scoreboard with quarter-by-quarter/period-by-period scores and weather.
    
    Args:
        sport: Sport type (football, basketball, hockey)
        league: League code (nfl, nba, nhl)
        date: Optional date in YYYYMMDD format
    
    Returns:
        Dictionary with detailed scoreboard showing period scores and weather
    
    Example:
        get_detailed_scoreboard("football", "nfl") -> NFL games with quarter scores and weather
        get_detailed_scoreboard("basketball", "nba") -> NBA games with quarter-by-quarter breakdown
    """
    result = await espn_handler.get_scoreboard(sport=sport, league=league, date=date, limit=10)
    
    if result.get("success") and result.get("data"):
        games = result["data"].get("events", [])
        formatted_output = format_detailed_scoreboard(games, sport=sport)
        
        return {
            "success": True,
            "formatted_output": formatted_output,
            "game_count": len(games)
        }
    
    return result


@mcp.tool()
async def get_formatted_standings(
    sport: str,
    league: str
) -> dict:
    """
    Get league standings in formatted table.
    
    Args:
        sport: Sport type (football, basketball, hockey)
        league: League code (nfl, nba, nhl)
    
    Returns:
        Dictionary with formatted standings table
    
    Example:
        get_formatted_standings("basketball", "nba") -> NBA standings table
    """
    result = await espn_handler.get_standings(sport=sport, league=league)
    
    if result.get("success") and result.get("data"):
        # Extract standings from ESPN response
        standings_data = result["data"].get("standings", [])
        if standings_data:
            all_teams = []
            for group in standings_data:
                entries = group.get("entries", [])
                all_teams.extend(entries)
            
            formatted_table = format_standings_table(all_teams)
            
            return {
                "success": True,
                "formatted_output": formatted_table
            }
    
    return result


@mcp.tool()
def get_team_reference(league: str) -> dict:
    """
    Get quick reference table of all teams in a league with IDs.
    
    Args:
        league: League code (nfl, nba, nhl)
    
    Returns:
        Dictionary with formatted team reference table
    
    Example:
        get_team_reference("nba") -> Table of all NBA teams with IDs
        get_team_reference("nfl") -> Table of all NFL teams with IDs
    """
    table = get_team_reference_table(league)
    
    return {
        "success": True,
        "formatted_output": table,
        "league": league.upper()
    }


@mcp.tool()
def find_team(team_name: str, league: str) -> dict:
    """
    Find team ID and info by name or abbreviation.
    
    Args:
        team_name: Team name or abbreviation (e.g., "Lakers", "LAL")
        league: League code (nfl, nba, nhl)
    
    Returns:
        Dictionary with team information
    
    Example:
        find_team("Lakers", "nba") -> Lakers team ID and details
        find_team("KC", "nfl") -> Chiefs team ID and details
    """
    team_info = find_team_id(team_name, league)
    
    if team_info:
        return {
            "success": True,
            "team": team_info
        }
    
    return {
        "success": False,
        "message": f"Team '{team_name}' not found in {league.upper()}"
    }


@mcp.tool()
async def get_odds_comparison(
    sport_key: str,
    team_query: Optional[str] = None
) -> dict:
    """
    Get odds comparison across multiple bookmakers in formatted view.
    
    Args:
        sport_key: Odds API sport key
        team_query: Optional team name to filter
    
    Returns:
        Dictionary with formatted odds comparison
    
    Example:
        get_odds_comparison("basketball_nba", "Lakers") -> Lakers odds from multiple bookmakers
    """
    if not odds_handler:
        return {"error": "Odds API not configured"}
    
    if team_query:
        result = await odds_handler.search_odds(query=team_query, sport=sport_key)
        games = result.get("matching_games", [])
    else:
        result = await odds_handler.get_odds(sport=sport_key)
        games = result.get("data", []) if result.get("success") else []
    
    if games:
        formatted_output = format_odds_comparison(games)
        return {
            "success": True,
            "formatted_output": formatted_output
        }
    
    return {"success": False, "message": "No odds found"}


# ============================================================================
# SERVER ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting Sports Data MCP Server...")
    logger.info(f"Odds API configured: {odds_handler is not None}")
    logger.info(f"ESPN API configured: True")
    
    # Run the server
    mcp.run()


# ============================================================================
# SERVER ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting Sports Data MCP Server...")
    logger.info(f"Odds API configured: {odds_handler is not None}")
    logger.info(f"ESPN API configured: True")
    
    # Run the server
    mcp.run()
