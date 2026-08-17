"""
Formatted Output & Combined MCP Tools
======================================
Tools that render ESPN/Odds data into human-readable tables and cards, plus
the team reference lookups and the combined odds+ESPN tool. These need both
handlers (or, for the reference/matchup tools, one of each), which is why
they are grouped separately from the single-source odds_tools/espn_tools.

`register_format_tools(mcp, espn_handler, odds_handler)` attaches every tool
in this module to the given FastMCP instance. `odds_handler` may be None
when ODDS_API_KEY is not configured; tools that need it degrade gracefully.
"""

from typing import Optional

from ..formatter import (
    format_matchup_card,
    format_scoreboard_table,
    format_detailed_scoreboard,
    format_standings_table,
)
from ..team_reference import get_team_reference_table, find_team_id

# Maps league code -> (ESPN sport type, display name). Used by get_scoreboard
# to resolve the sport type from a league code alone.
LEAGUE_SPORT_MAP: dict[str, tuple[str, str]] = {
    "nfl":  ("football",    "NFL"),
    "nba":  ("basketball",  "NBA"),
    "mlb":  ("baseball",    "MLB"),
    "nhl":  ("hockey",      "NHL"),
    "wnba": ("basketball",  "WNBA"),
    "college-football":         ("football",   "College Football"),
    "mens-college-basketball":  ("basketball", "Men's College Basketball"),
    "womens-college-basketball":("basketball", "Women's College Basketball"),
}


def register_format_tools(mcp, espn_handler, odds_handler) -> None:
    """Attach the formatted-output and combined tools to `mcp`.

    Args:
        mcp: A FastMCP server instance
        espn_handler: An ESPNAPIHandler instance
        odds_handler: An OddsAPIHandler instance, or None if ODDS_API_KEY is
            not configured
    """

    @mcp.tool()
    async def get_scoreboard(
        league: str,
        date: Optional[str] = None
    ) -> dict:
        """
        Get the current scoreboard for any supported league (formatted table output).
        Automatically resolves the ESPN sport type from the league code.

        Supported leagues: nfl, nba, mlb, nhl, wnba,
                           college-football, mens-college-basketball,
                           womens-college-basketball

        Args:
            league: League code (e.g., "nfl", "nba", "mlb", "nhl")
            date: Optional date in YYYYMMDD format (default: today)

        Returns:
            Dictionary with formatted scoreboard table

        Example:
            get_scoreboard("nba") -> NBA games in table format
            get_scoreboard("nfl", "20260109") -> NFL games on Jan 9, 2026
        """
        league_lower = league.lower()
        if league_lower not in LEAGUE_SPORT_MAP:
            supported = ", ".join(LEAGUE_SPORT_MAP.keys())
            return {
                "success": False,
                "error": f"Unsupported league '{league}'. Supported leagues: {supported}"
            }

        sport, display_name = LEAGUE_SPORT_MAP[league_lower]
        result = await espn_handler.get_scoreboard(sport=sport, league=league_lower, date=date, limit=15)

        if result.get("success") and result.get("data"):
            games = result["data"].get("events", [])
            formatted_table = format_scoreboard_table(games)

            return {
                "success": True,
                "league": display_name,
                "formatted_output": formatted_table,
                "game_count": len(games)
            }

        return result

    @mcp.tool()
    async def get_formatted_scoreboard(
        sport: str,
        league: str,
        date: Optional[str] = None
    ) -> dict:
        """
        Get scoreboard with formatted table output (concise ESPN data).

        Prefer get_scoreboard(league) for simpler usage — it resolves the sport
        type automatically from the league code.

        Args:
            sport: Sport type (football, basketball, baseball, hockey)
            league: League code (nfl, nba, mlb, nhl)
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
