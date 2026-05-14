#!/usr/bin/env python3
"""
Sports Dashboard MCP Server
Enables Claude to interact with the betting dashboard via API keys
"""

from mcp.server.fastmcp import FastMCP
import aiohttp
import atexit
import asyncio
import os
import sys
from typing import Optional, Dict, Any
import json

# Initialize FastMCP server
mcp = FastMCP("Sports Dashboard")

# Configuration
API_KEY = os.getenv("DASHBOARD_API_KEY")
# SECURITY: For hosted/production deployments DASHBOARD_API_URL MUST use HTTPS.
# HTTP is acceptable only for localhost development.
API_URL = os.getenv("DASHBOARD_API_URL", "http://localhost:3001")

if not API_KEY:
    print("ERROR: DASHBOARD_API_KEY environment variable not set", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Singleton aiohttp session (M5)
# ---------------------------------------------------------------------------
_session: Optional[aiohttp.ClientSession] = None


async def _get_session() -> aiohttp.ClientSession:
    """Return the shared aiohttp session, creating it on first call."""
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


def _close_session() -> None:
    """Synchronously schedule session closure on interpreter shutdown."""
    global _session
    if _session and not _session.closed:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_session.close())
            else:
                loop.run_until_complete(_session.close())
        except Exception:
            pass


atexit.register(_close_session)


async def make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Make authenticated request to dashboard API.

    Returns a structured error dict for HTTP 4xx/5xx responses so the LLM
    receives a clear failure signal instead of a raw error body.
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    url = f"{API_URL}/api{endpoint}"
    session = await _get_session()

    if method == "GET":
        response = await session.get(url, headers=headers, params=params)
    elif method == "POST":
        response = await session.post(url, headers=headers, json=data)
    elif method == "DELETE":
        response = await session.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported method: {method}")

    if response.status >= 400:
        detail = await response.text()
        return {
            "error": f"HTTP {response.status}",
            "status": response.status,
            "detail": detail
        }

    return await response.json()


@mcp.tool()
async def create_bet(
    game_id: str,
    selection_type: str,
    selection: str,
    stake: float,
    odds: int,
    line: Optional[float] = None,
    name: Optional[str] = None
) -> dict:
    """
    Create a single straight bet on the dashboard.

    Routes to POST /api/mcp/bets/quick-create (apiKeyAuth required).
    For parlay bets use the dashboard web UI directly — parlay MCP support
    is not yet implemented.

    WORKFLOW:
    1. Call get_active_games() to find available games and their IDs.
    2. Call create_bet() with the chosen game ID and your selection.

    Args:
        game_id: Game UUID from get_active_games()
        selection_type: "moneyline", "spread", or "total"
        selection: "home", "away", "over", or "under"
        stake: Dollar amount to wager (positive)
        odds: American odds — must be ≤ -100 or ≥ +100 (e.g. -110, +150)
        line: Optional spread or total line (e.g. -3.5, 215.5)
        name: Optional human-readable bet name (auto-generated if omitted)

    Returns:
        dict: Created bet with id, name, stake, potential_payout, and odds

    Example:
        games = get_active_games(sport="basketball_nba")
        game_id = games["data"]["games"][0]["id"]
        create_bet(game_id=game_id, selection_type="spread",
                   selection="home", odds=-110, line=-3.5, stake=10.0)
    """
    response = await make_request(
        "POST",
        "/mcp/bets/quick-create",
        data={
            "game_id": game_id,
            "selection_type": selection_type,
            "selection": selection,
            "stake": stake,
            "odds": odds,
            "line": line,
            "name": name
        }
    )
    return response


@mcp.tool()
async def get_active_games(sport: Optional[str] = None, status: Optional[str] = None) -> dict:
    """
    Get games available for betting.

    Routes to GET /api/mcp/games (apiKeyAuth, requirePermission('bets')).

    Args:
        sport: Optional sport key filter (e.g. "basketball_nba", "americanfootball_nfl")
        status: Optional status filter (e.g. "scheduled", "in_progress")

    Returns:
        dict: {status, data: {games: [...], count}} where each game has
              id, matchup, home_team, away_team, sport, sport_key,
              commence_time, status, home_score, away_score

    Example:
        get_active_games(sport="basketball_nba")
    """
    params: Dict[str, Any] = {}
    if sport:
        params["sport"] = sport
    if status:
        params["status"] = status

    return await make_request("GET", "/mcp/games", params=params)


@mcp.tool()
async def get_my_bets(status: str = "all") -> dict:
    """
    Get the user's betting history.

    Routes to GET /api/mcp/bets (apiKeyAuth, requirePermission('bets')).
    Returns only bets belonging to the API key owner.

    Args:
        status: Filter by status — "all", "pending", "won", "lost", or "push"
                (default: "all")

    Returns:
        dict: {status, data: {bets: [...], total, limit, offset}}

    Example:
        get_my_bets(status="pending")
    """
    params: Dict[str, Any] = {}
    if status != "all":
        params["status"] = status

    return await make_request("GET", "/mcp/bets", params=params)


@mcp.tool()
async def get_bet_details(bet_id: str) -> dict:
    """
    Get detailed information about a specific bet.

    Routes to GET /api/mcp/bets/:id (apiKeyAuth, requirePermission('bets')).
    Returns 404 if the bet does not belong to the API key owner.

    Args:
        bet_id: UUID of the bet

    Returns:
        dict: {status, data: {bet: {...legs, game details, timeline}}}
    """
    return await make_request("GET", f"/mcp/bets/{bet_id}")


@mcp.tool()
async def get_game_odds(game_id: str) -> dict:
    """
    Get current bookmaker odds for a specific game.

    Routes to GET /api/mcp/games/:id/odds (apiKeyAuth).

    Args:
        game_id: UUID of the game

    Returns:
        dict: {status, data: {game: {...}, odds: [{bookmaker, marketType,
              homePrice, awayPrice, homeSpread, ...}]}}
    """
    return await make_request("GET", f"/mcp/games/{game_id}/odds")


@mcp.tool()
async def search_teams(query: str) -> dict:
    """
    Search for teams by name or abbreviation.

    Routes to GET /api/mcp/teams/search (apiKeyAuth).

    Args:
        query: Search term (e.g. "Lakers", "LAL", "Los Angeles") — min 1 char

    Returns:
        dict: {status, data: {teams: [{id, name, abbr, sport, logoUrl}], count}}
    """
    return await make_request("GET", "/mcp/teams/search", params={"q": query})


@mcp.tool()
async def get_dashboard_stats() -> dict:
    """
    Get betting statistics and performance summary for the current user.

    Routes to GET /api/mcp/bets/summary (apiKeyAuth, requirePermission('stats')).
    Returns only statistics for bets belonging to the API key owner.

    Returns:
        dict: {status, data: {active: {count, total_stake, potential_return},
              today: {bets, won, lost, pnl},
              this_week: {bets, win_rate, pnl},
              all_time: {total_bets, win_rate, total_pnl, roi}}}
    """
    return await make_request("GET", "/mcp/bets/summary")


@mcp.tool()
async def get_advice_context() -> dict:
    """
    Get full betting context for AI advice generation.

    Routes to GET /api/mcp/bets/advice-context
    (apiKeyAuth, requirePermission('stats')).
    Returns up to 100 active bets, last 10 settled bets, all-time stats,
    sport breakdown, and a risk analysis for the API key owner.

    Returns:
        dict: {status, data: {active_bets, recent_results, bankroll_exposure,
              sport_breakdown}, analysis: {risk_level, exposure_percentage,
              is_diversified, current_streak, suggestions}}
    """
    return await make_request("GET", "/mcp/bets/advice-context")


@mcp.tool()
async def get_games_with_exposure(sport: Optional[str] = None, only_with_bets: bool = False) -> dict:
    """
    Get today's games annotated with the user's existing betting exposure.

    Routes to GET /api/mcp/games/with-exposure
    (apiKeyAuth, requirePermission('bets')).
    Only shows bets belonging to the API key owner. Game window spans
    midnight-to-midnight so earlier-today games are included.

    Args:
        sport: Optional sport key filter (e.g. "basketball_nba")
        only_with_bets: If True, returns only games where the user has bets

    Returns:
        dict: {status, data: {games: [{id, matchup, sport, commence_time,
              status, my_bets: [{bet_id, selection, stake, potential}],
              total_exposure}], total_games, total_exposure}}
    """
    params: Dict[str, Any] = {}
    if sport:
        params["sport"] = sport
    if only_with_bets:
        params["onlyWithBets"] = "true"

    return await make_request("GET", "/mcp/games/with-exposure", params=params)


if __name__ == "__main__":
    # Run the MCP server
    mcp.run()
