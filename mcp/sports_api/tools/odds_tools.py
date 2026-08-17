"""
The Odds API MCP Tools
=======================
Betting odds, scores, and event lookups backed by `OddsAPIHandler`.

`register_odds_tools(mcp, odds_handler)` attaches every tool in this module
to the given FastMCP instance. `odds_handler` is `None` when ODDS_API_KEY is
not configured; each tool below returns an explanatory error in that case
rather than raising.
"""

from typing import Optional


def register_odds_tools(mcp, odds_handler) -> None:
    """Attach the Odds API tools to `mcp`.

    Args:
        mcp: A FastMCP server instance
        odds_handler: An OddsAPIHandler instance, or None if ODDS_API_KEY is
            not configured
    """

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
            markets: Comma-separated markets (default: h2h)
                Game markets: h2h (moneyline), spreads, totals, outrights
                Player props: player_points, player_rebounds, player_assists, player_threes,
                             player_pass_tds, player_pass_yds, player_rush_yds, player_receptions,
                             player_home_runs, player_hits, player_strikeouts, and many more
                Use comma-separated for multiple: "h2h,spreads,player_points"
            odds_format: american, decimal, or fractional (default: american)
            date_format: iso or unix (default: iso)

        Returns:
            Dictionary with games and their odds from multiple bookmakers

        Example:
            get_odds("americanfootball_nfl") -> NFL odds from US bookmakers
            get_odds("basketball_nba", markets="h2h,spreads,player_points") -> NBA game odds + player points props
            get_odds("americanfootball_nfl", markets="player_pass_tds,player_rush_yds") -> NFL player props
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
            markets: Comma-separated markets (default: h2h if not specified)
                Game markets: h2h, spreads, totals
                Player props: player_points, player_assists, player_pass_tds, player_rush_yds, etc.
            odds_format: american, decimal, or fractional (default: american)

        Returns:
            Dictionary with detailed odds for the specific event

        Example:
            get_event_odds("basketball_nba", "abc123xyz") -> Detailed odds for specific NBA game
            get_event_odds("basketball_nba", "abc123", markets="h2h,player_points,player_rebounds")
            get_event_odds("americanfootball_nfl", "xyz789", markets="player_pass_tds,player_rush_yds")
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
                Game markets: h2h, spreads, totals
                Player props: player_points, player_assists, player_pass_tds, player_rush_yds, etc.

        Returns:
            Dictionary with matching games and their odds

        Example:
            search_odds("Lakers") -> Finds Lakers games with odds
            search_odds("Chiefs vs Bills", "americanfootball_nfl") -> Specific NFL matchup odds
            search_odds("Lakers", "basketball_nba", markets="player_points,player_rebounds")
        """
        if not odds_handler:
            return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}

        return await odds_handler.search_odds(
            query=query,
            sport=sport,
            regions=regions,
            markets=markets
        )
