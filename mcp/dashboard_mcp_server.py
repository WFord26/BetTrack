#!/usr/bin/env python3
"""
Sports Dashboard MCP Server
Enables Claude to interact with the betting dashboard via API keys
"""

from mcp.server.fastmcp import FastMCP
import aiohttp
import os
import sys
from typing import Optional, Dict, Any, List
import json

# Initialize FastMCP server
mcp = FastMCP("Sports Dashboard")

# Configuration
API_KEY = os.getenv("DASHBOARD_API_KEY")
API_URL = os.getenv("DASHBOARD_API_URL", "http://localhost:3001")

if not API_KEY:
    print("ERROR: DASHBOARD_API_KEY environment variable not set", file=sys.stderr)
    sys.exit(1)


async def make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Make authenticated request to dashboard API"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{API_URL}/api{endpoint}"
    
    async with aiohttp.ClientSession() as session:
        if method == "GET":
            async with session.get(url, headers=headers, params=params) as response:
                return await response.json()
        elif method == "POST":
            async with session.post(url, headers=headers, json=data) as response:
                return await response.json()
        elif method == "DELETE":
            async with session.delete(url, headers=headers) as response:
                return await response.json()
        else:
            raise ValueError(f"Unsupported method: {method}")


@mcp.tool()
async def create_bet(
    selections: list[dict],
    bet_type: str,
    stake: float,
    notes: str = ""
) -> dict:
    """
    Create a bet on the dashboard using specific game IDs
    
    WORKFLOW:
    1. Call get_active_games() to see available games with their IDs
    2. User selects games they want to bet on
    3. Call create_bet() with those game IDs
    
    Args:
        selections: List of bet selections with game IDs
            Each selection must have:
            - gameId: Game ID from get_active_games() (UUID string)
            - type: "moneyline", "spread", or "total"
            - selection: "home", "away", "over", or "under"
            - odds: American odds (e.g., -110, +150)
            - line: Optional spread/total line (e.g., -3.5, 215.5)
            - teamName: Optional team name for display
        bet_type: Type of bet ("single", "parlay", "teaser")
        stake: Amount to wager in dollars
        notes: Optional notes about the bet
    
    Returns:
        dict: Created bet with ID, legs, and potential payout
    
    Example:
        # First get games
        games = get_active_games(sport="basketball_nba")
        lakers_game_id = games["games"][0]["id"]
        
        # Then create bet with specific game ID
        create_bet(
            selections=[{
                "gameId": lakers_game_id,
                "type": "spread",
                "selection": "home",
                "odds": -110,
                "line": -3.5,
                "teamName": "Lakers"
            }],
            bet_type="single",
            stake=10.00,
            notes="Lakers look strong at home"
        )
    """
    response = await make_request(
        "POST",
        "/ai/bets",
        data={
            "selections": selections,
            "betType": bet_type,
            "stake": stake,
            "notes": notes,
            "source": "mcp"
        }
    )
    return response


@mcp.tool()
async def get_active_games(sport: Optional[str] = None, date: Optional[str] = None) -> dict:
    """
    Get list of active games available for betting
    
    Args:
        sport: Optional sport filter (e.g., "basketball_nba", "americanfootball_nfl")
        date: Optional date filter in YYYY-MM-DD format (defaults to today)
    
    Returns:
        dict: List of games with odds, teams, and times
    
    Example:
        get_active_games(sport="basketball_nba")
    """
    params = {}
    if sport:
        params["sport"] = sport
    if date:
        params["date"] = date
    
    response = await make_request("GET", "/games", params=params)
    return response


@mcp.tool()
async def get_my_bets(status: str = "all") -> dict:
    """
    Get user's betting history
    
    Args:
        status: Filter by status ("all", "pending", "won", "lost", "pushed")
    
    Returns:
        dict: List of bets with legs, outcomes, and payouts
    
    Example:
        get_my_bets(status="pending")
    """
    params = {}
    if status != "all":
        params["status"] = status
    
    response = await make_request("GET", "/bets", params=params)
    return response


@mcp.tool()
async def get_bet_details(bet_id: str) -> dict:
    """
    Get detailed information about a specific bet
    
    Args:
        bet_id: UUID of the bet
    
    Returns:
        dict: Bet details including all legs, outcomes, and timeline
    """
    response = await make_request("GET", f"/bets/{bet_id}")
    return response


@mcp.tool()
async def get_game_odds(game_id: str) -> dict:
    """
    Get current odds for a specific game
    
    Args:
        game_id: UUID of the game
    
    Returns:
        dict: Game details with all available odds from bookmakers
    """
    response = await make_request("GET", f"/games/{game_id}/odds")
    return response


@mcp.tool()
async def search_teams(query: str) -> dict:
    """
    Search for teams by name or abbreviation
    
    Args:
        query: Search term (e.g., "Lakers", "LAL", "Los Angeles")
    
    Returns:
        dict: List of matching teams
    """
    response = await make_request("GET", "/teams/search", params={"q": query})
    return response


@mcp.tool()
async def get_dashboard_stats() -> dict:
    """
    Get user's betting statistics and performance metrics
    
    Returns:
        dict: Win rate, total bets, profit/loss, and other stats
    """
    response = await make_request("GET", "/bets/stats")
    return response


if __name__ == "__main__":
    # Run the MCP server
    mcp.run()
