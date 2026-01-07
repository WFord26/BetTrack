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
from dotenv import load_dotenv
from mcp.server import FastMCP

# Import API handlers
from sports_api.odds_api_handler import OddsAPIHandler
from sports_api.espn_api_handler import ESPNAPIHandler

# Load environment variables
load_dotenv()

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
def get_available_sports(all_sports: bool = False) -> dict:
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
    
    return odds_handler.get_sports(all_sports=all_sports)


@mcp.tool()
def get_odds(
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
    
    return odds_handler.get_odds(
        sport=sport,
        regions=regions,
        markets=markets,
        odds_format=odds_format,
        date_format=date_format
    )


@mcp.tool()
def get_scores(sport: str, days_from: int = 3) -> dict:
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
    
    return odds_handler.get_scores(sport=sport, days_from=days_from)


@mcp.tool()
def get_event_odds(
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
    
    return odds_handler.get_event_odds(
        sport=sport,
        event_id=event_id,
        regions=regions,
        markets=markets,
        odds_format=odds_format
    )


@mcp.tool()
def search_odds(
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
    
    return odds_handler.search_odds(
        query=query,
        sport=sport,
        regions=regions,
        markets=markets
    )


# ============================================================================
# ESPN API TOOLS
# ============================================================================

@mcp.tool()
def get_espn_scoreboard(
    sport: str,
    league: str,
    date: Optional[str] = None,
    limit: int = 50
) -> dict:
    """
    Get current/scheduled games from ESPN scoreboard.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, college-football, mens-college-basketball, etc.)
        date: Optional date in YYYYMMDD format (default: today)
        limit: Maximum number of games to return (default: 50)
    
    Returns:
        Dictionary with scoreboard data including scores, status, teams
    
    Example:
        get_espn_scoreboard("football", "nfl") -> Current NFL scoreboard
        get_espn_scoreboard("basketball", "nba", "20260210") -> NBA games on Feb 10, 2026
    """
    return espn_handler.get_scoreboard(
        sport=sport,
        league=league,
        date=date,
        limit=limit
    )


@mcp.tool()
def get_espn_standings(sport: str, league: str, season: Optional[int] = None) -> dict:
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
    return espn_handler.get_standings(
        sport=sport,
        league=league,
        season=season
    )


@mcp.tool()
def get_espn_teams(sport: str, league: str) -> dict:
    """
    Get list of teams for a specific league.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
    
    Returns:
        Dictionary with list of teams and their details
    
    Example:
        get_espn_teams("football", "nfl") -> List of NFL teams
        get_espn_teams("basketball", "nba") -> List of NBA teams
    """
    return espn_handler.get_teams(sport=sport, league=league)


@mcp.tool()
def get_espn_team_details(
    sport: str,
    league: str,
    team_id: str,
    include_roster: bool = False
) -> dict:
    """
    Get detailed information about a specific team.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        team_id: Team ID
        include_roster: Whether to include team roster (default: False)
    
    Returns:
        Dictionary with team details, stats, and optionally roster
    
    Example:
        get_espn_team_details("basketball", "nba", "17") -> Lakers team details
        get_espn_team_details("football", "nfl", "12", True) -> Chiefs with roster
    """
    return espn_handler.get_team_details(
        sport=sport,
        league=league,
        team_id=team_id,
        include_roster=include_roster
    )


@mcp.tool()
def get_espn_team_schedule(
    sport: str,
    league: str,
    team_id: str,
    season: Optional[int] = None
) -> dict:
    """
    Get team schedule and results.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        team_id: Team ID
        season: Optional season year (default: current season)
    
    Returns:
        Dictionary with team schedule and game results
    
    Example:
        get_espn_team_schedule("basketball", "nba", "17") -> Lakers schedule
    """
    return espn_handler.get_team_schedule(
        sport=sport,
        league=league,
        team_id=team_id,
        season=season
    )


@mcp.tool()
def get_espn_news(
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
    return espn_handler.get_news(
        sport=sport,
        league=league,
        limit=limit
    )


@mcp.tool()
def search_espn(query: str, limit: int = 10) -> dict:
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
    return espn_handler.search(query=query, limit=limit)


@mcp.tool()
def get_espn_game_summary(sport: str, league: str, event_id: str) -> dict:
    """
    Get detailed game summary with box score and play-by-play.
    
    Args:
        sport: Sport type (football, basketball, baseball, hockey, soccer)
        league: League code (nfl, nba, mlb, nhl, etc.)
        event_id: Game/Event ID
    
    Returns:
        Dictionary with detailed game summary
    
    Example:
        get_espn_game_summary("basketball", "nba", "401584920") -> NBA game summary
    """
    return espn_handler.get_game_summary(
        sport=sport,
        league=league,
        event_id=event_id
    )


# ============================================================================
# COMBINED/UTILITY TOOLS
# ============================================================================

@mcp.tool()
def get_comprehensive_game_info(
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
            odds_result = odds_handler.search_odds(query=team_query, sport=sport_key)
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
        
        espn_result = espn_handler.get_scoreboard(sport=sport_type, league=league)
        result["espn_data"] = espn_result
    except Exception as e:
        if result["error"]:
            result["error"] += f"; ESPN API error: {str(e)}"
        else:
            result["error"] = f"ESPN API error: {str(e)}"
    
    return result


# ============================================================================
# SERVER ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    logger.info("Starting Sports Data MCP Server...")
    logger.info(f"Odds API configured: {odds_handler is not None}")
    logger.info(f"ESPN API configured: True")
    
    # Run the server
    mcp.run()
