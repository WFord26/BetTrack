"""
ESPN API MCP Tools
==================
Team, schedule, standings, news, and search tools backed by
`ESPNAPIHandler`. ESPN needs no API key, so unlike the odds tools these are
always registered.

`register_espn_tools(mcp, espn_handler)` attaches every tool in this module
to the given FastMCP instance.
"""

from typing import Optional


def register_espn_tools(mcp, espn_handler) -> None:
    """Attach the ESPN API tools to `mcp`.

    Args:
        mcp: A FastMCP server instance
        espn_handler: An ESPNAPIHandler instance
    """

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
