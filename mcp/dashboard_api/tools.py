"""
BetTrack Dashboard MCP Tools
============================
Every dashboard tool, defined as a single `register_dashboard_tools(mcp)`
call so the same set can be attached either to the combined Sports Data MCP
server or to the standalone dashboard server.

Tools are grouped as:
  * Bets and games  — read, plus one write (create_bet)
  * Analytics       — read only, requires the API key's 'stats' permission

Import side effects are deliberately nil: nothing here touches the network or
reads the environment until `register_dashboard_tools` is called.
"""

from typing import Any, Dict, List, Optional

from . import client


def register_dashboard_tools(mcp) -> List[str]:
    """Attach every dashboard tool to the given FastMCP instance.

    Args:
        mcp: A FastMCP server instance

    Returns:
        The names of the tools that were registered, in declaration order.
    """
    registered: List[str] = []

    def _tool():
        """Register with FastMCP and record the name, so callers can log
        exactly what was added without hardcoding a count."""
        def decorator(fn):
            registered.append(fn.__name__)
            return mcp.tool()(fn)
        return decorator

    @_tool()
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
        response = await client.make_request(
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


    @_tool()
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

        return await client.make_request("GET", "/mcp/games", params=params)


    @_tool()
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

        return await client.make_request("GET", "/mcp/bets", params=params)


    @_tool()
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
        return await client.make_request("GET", f"/mcp/bets/{bet_id}")


    @_tool()
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
        return await client.make_request("GET", f"/mcp/games/{game_id}/odds")


    @_tool()
    async def search_teams(query: str) -> dict:
        """
        Search for teams by name or abbreviation.

        Routes to GET /api/mcp/teams/search (apiKeyAuth).

        Args:
            query: Search term (e.g. "Lakers", "LAL", "Los Angeles") — min 1 char

        Returns:
            dict: {status, data: {teams: [{id, name, abbr, sport, logoUrl}], count}}
        """
        return await client.make_request("GET", "/mcp/teams/search", params={"q": query})


    @_tool()
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
        return await client.make_request("GET", "/mcp/bets/summary")


    @_tool()
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
        return await client.make_request("GET", "/mcp/bets/advice-context")


    @_tool()
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

        return await client.make_request("GET", "/mcp/games/with-exposure", params=params)


    # ===========================================================================
    # ANALYTICS TOOLS
    # ===========================================================================
    # All routes below live under /api/mcp/analytics/* and require an API key
    # with the 'stats' permission. They mirror the dashboard's session gated
    # /api/analytics/* endpoints and are read only, with the single exception of
    # the stateless arbitrage stake calculator.


    @_tool()
    async def get_arbitrage_opportunities(
        limit: int = 25,
        min_profit: Optional[float] = None,
        arb_type: Optional[str] = None,
        market_type: Optional[str] = None,
        max_snapshot_age: Optional[int] = None
    ) -> dict:
        """
        Find live arbitrage opportunities across bookmakers, best profit first.

        Routes to GET /api/mcp/analytics/arbitrage/live
        (apiKeyAuth, requirePermission('stats')).

        Args:
            limit: Max opportunities to return, 1 to 100 (default: 25)
            min_profit: Minimum guaranteed profit percentage (e.g. 1.5)
            arb_type: "two-way", "three-way", or "middle"
            market_type: "h2h", "spreads", or "totals"
            max_snapshot_age: Reject opportunities whose underlying odds snapshot
                is older than this many seconds. Use a low value (30 to 60) before
                acting on an arb, since stale lines produce phantom opportunities.

        Returns:
            dict: {success, data: {opportunities: [{id, gameId, matchup, arbType,
                  marketType, profitPercentage, legs: [{bookmaker, side, odds,
                  line}], riskLevel, detectedAt}], count, retrievedAt}}

        Example:
            get_arbitrage_opportunities(min_profit=1.0, max_snapshot_age=60)
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/arbitrage/live",
            params=client.clean_params(
                limit=limit,
                minProfit=min_profit,
                arbType=arb_type,
                marketType=market_type,
                maxSnapshotAge=max_snapshot_age
            )
        )


    @_tool()
    async def get_arbitrage_history(
        limit: int = 50,
        days_back: int = 7,
        status: Optional[str] = None,
        mine: bool = False
    ) -> dict:
        """
        Get previously detected arbitrage opportunities.

        Routes to GET /api/mcp/analytics/arbitrage/history
        (apiKeyAuth, requirePermission('stats')).

        Args:
            limit: Max rows, 1 to 200 (default: 50)
            days_back: Look back window in days, 1 to 90 (default: 7)
            status: "active", "expired", or "taken"
            mine: If True, restrict to opportunities the key owner marked taken

        Returns:
            dict: {success, data: {opportunities: [...], count, period}}

        Example:
            get_arbitrage_history(days_back=30, status="taken", mine=True)
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/arbitrage/history",
            params=client.clean_params(
                limit=limit,
                daysBack=days_back,
                status=status,
                mine="true" if mine else None
            )
        )


    @_tool()
    async def get_arbitrage_stats(days_back: int = 30, mine: bool = False) -> dict:
        """
        Get arbitrage detection and realisation statistics.

        Routes to GET /api/mcp/analytics/arbitrage/stats
        (apiKeyAuth, requirePermission('stats')).

        Args:
            days_back: Look back window in days, 1 to 365 (default: 30)
            mine: If True, restrict to the key owner's taken opportunities

        Returns:
            dict: {success, data: {totalDetected, totalTaken, avgProfitPercentage,
                  bestProfitPercentage, byArbType, byMarketType}}
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/arbitrage/stats",
            params=client.clean_params(daysBack=days_back, mine="true" if mine else None)
        )


    @_tool()
    async def calculate_arbitrage_stakes(odds: list[float], total_stake: float) -> dict:
        """
        Calculate the optimal stake split across an arbitrage set.

        Routes to POST /api/mcp/analytics/arbitrage/calculator
        (apiKeyAuth, requirePermission('stats')). Stateless — nothing is saved.

        Args:
            odds: 2 to 4 American odds values, one per leg (e.g. [-110, 130]).
                  Must be non zero and each ≤ -100 or ≥ +100 in practice.
            total_stake: Total dollars to distribute across all legs (positive)

        Returns:
            dict: {success, data: {stakes: [...], totalStake, guaranteedReturn,
                  profit, profitPercentage, isArbitrage}}

        Example:
            calculate_arbitrage_stakes(odds=[-110, 135], total_stake=500)
        """
        return await client.make_request(
            "POST",
            "/mcp/analytics/arbitrage/calculator",
            data={"odds": odds, "totalStake": total_stake}
        )


    @_tool()
    async def get_clv_summary() -> dict:
        """
        Get the user's overall closing line value summary.

        Routes to GET /api/mcp/analytics/clv/summary
        (apiKeyAuth, requirePermission('stats')).

        CLV measures whether you consistently beat the closing line, which is a
        better long run skill signal than win rate over a small sample.

        Returns:
            dict: {success, data: {totalBets, betsWithCLV, avgCLV, positiveCLVCount,
                  negativeCLVCount, positiveCLVPercentage, totalCLVDollars}}
        """
        return await client.make_request("GET", "/mcp/analytics/clv/summary")


    @_tool()
    async def get_clv_by_sport() -> dict:
        """
        Get closing line value broken down by sport.

        Routes to GET /api/mcp/analytics/clv/by-sport
        (apiKeyAuth, requirePermission('stats')).

        Use this to find which sports the user actually has an edge in.

        Returns:
            dict: {success, data: [{sportKey, sportName, betCount, avgCLV,
                  positiveCLVPercentage}]}
        """
        return await client.make_request("GET", "/mcp/analytics/clv/by-sport")


    @_tool()
    async def get_clv_by_bookmaker() -> dict:
        """
        Get closing line value broken down by bookmaker.

        Routes to GET /api/mcp/analytics/clv/by-bookmaker
        (apiKeyAuth, requirePermission('stats')).

        Consistently negative CLV at one book usually means its lines are sharper
        than where the user is shopping, or that the user is getting there late.

        Returns:
            dict: {success, data: [{bookmaker, betCount, avgCLV,
                  positiveCLVPercentage}]}
        """
        return await client.make_request("GET", "/mcp/analytics/clv/by-bookmaker")


    @_tool()
    async def get_clv_report(
        sport_key: Optional[str] = None,
        bet_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> dict:
        """
        Get the full closing line value report with best and worst bets.

        Routes to GET /api/mcp/analytics/clv/report
        (apiKeyAuth, requirePermission('stats')).

        Args:
            sport_key: Filter by sport (e.g. "basketball_nba")
            bet_type: Filter by bet type (e.g. "moneyline", "spread", "total")
            start_date: ISO date string, inclusive (e.g. "2026-01-01")
            end_date: ISO date string, inclusive

        Returns:
            dict: {success, data: {summary, bySport, byBookmaker, topBets,
                  worstBets}}

        Example:
            get_clv_report(sport_key="americanfootball_nfl", start_date="2026-09-01")
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/clv/report",
            params=client.clean_params(
                sportKey=sport_key,
                betType=bet_type,
                startDate=start_date,
                endDate=end_date
            )
        )


    @_tool()
    async def get_sharp_action(limit: int = 20) -> dict:
        """
        Get current sharp money indicators for scheduled games.

        Routes to GET /api/mcp/analytics/sharp/live
        (apiKeyAuth, requirePermission('stats')).

        Args:
            limit: Max games to return, 1 to 100 (default: 20)

        Returns:
            dict: {success, data: {indicators: [{gameId, matchup, marketType,
                  sharpSide, confidence, reverseLineMovement, steamDetected,
                  detectedAt}], count}}
        """
        return await client.make_request(
            "GET", "/mcp/analytics/sharp/live", params=client.clean_params(limit=limit)
        )


    @_tool()
    async def get_contrarian_plays(min_confidence: int = 6, limit: int = 20) -> dict:
        """
        Get games where sharp money opposes likely public action.

        Routes to GET /api/mcp/analytics/sharp/contrarian
        (apiKeyAuth, requirePermission('stats')).

        These are fade the public spots: the line moves against the side taking
        most of the tickets, which implies larger money on the other side.

        Args:
            min_confidence: Minimum sharp confidence score, 1 to 10 (default: 6)
            limit: Max games to return, 1 to 100 (default: 20)

        Returns:
            dict: {success, data: {opportunities: [{gameId, matchup, sharpSide,
                  publicSide, confidence, reasoning, commenceTime}], count,
                  minConfidence}}
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/sharp/contrarian",
            params=client.clean_params(minConfidence=min_confidence, limit=limit)
        )


    @_tool()
    async def get_game_sharp_indicators(game_id: str) -> dict:
        """
        Get sharp money indicators for one specific game, latest per market.

        Routes to GET /api/mcp/analytics/sharp/game/:gameId
        (apiKeyAuth, requirePermission('stats')). Returns 404 if the game is
        unknown.

        Args:
            game_id: Game UUID from get_active_games()

        Returns:
            dict: {success, data: {game: {id, matchup, sport, sportKey,
                  commenceTime, status}, indicators: [...]}}
        """
        return await client.make_request("GET", f"/mcp/analytics/sharp/game/{game_id}")


    @_tool()
    async def get_line_movements(
        hours_back: int = 4,
        movement_type: str = "steam",
        limit: int = 20
    ) -> dict:
        """
        Get recent line movements across all tracked games.

        Routes to GET /api/mcp/analytics/movements/live
        (apiKeyAuth, requirePermission('stats')).

        Args:
            hours_back: Look back window in hours, 1 to 168 (default: 4)
            movement_type: "steam" (default), "reverse", "gradual", "injury",
                or "all". Steam moves are fast coordinated moves across books;
                reverse moves go against the public ticket split.
            limit: Max movements to return, 1 to 200 (default: 20)

        Returns:
            dict: {success, data: {movements: [{id, gameId, marketType,
                  movementType, averageMovement, linesBefore, linesAfter,
                  detectedAt}], total, hoursBack, movementType}}

        Example:
            get_line_movements(hours_back=12, movement_type="reverse")
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/movements/live",
            params=client.clean_params(
                hoursBack=hours_back, movementType=movement_type, limit=limit
            )
        )


    @_tool()
    async def get_game_line_movements(game_id: str, limit: int = 50) -> dict:
        """
        Get the full line movement history for one game.

        Routes to GET /api/mcp/analytics/movements/game/:gameId
        (apiKeyAuth, requirePermission('stats')). Returns 404 if the game is
        unknown.

        Args:
            game_id: Game UUID from get_active_games()
            limit: Max movements to return, 1 to 200 (default: 50)

        Returns:
            dict: {success, data: {game: {id, matchup, sport, commenceTime},
                  movements: [...], total}}
        """
        return await client.make_request(
            "GET",
            f"/mcp/analytics/movements/game/{game_id}",
            params=client.clean_params(limit=limit)
        )


    @_tool()
    async def get_market_disagreement(threshold: int = 60, limit: int = 20) -> dict:
        """
        Get games where bookmakers disagree most on the line.

        Routes to GET /api/mcp/analytics/disagreement/live
        (apiKeyAuth, requirePermission('stats')).

        High disagreement means one or more books are outliers, which is where
        the best available price usually is.

        Args:
            threshold: Minimum disagreement score, 1 to 100 (default: 60)
            limit: Max games to return, 1 to 100 (default: 20)

        Returns:
            dict: {success, data: {games: [{gameId, matchup, marketType,
                  disagreementScore, consensusLine, outliers: [{bookmaker,
                  deviation}], bestValue}], threshold, count}}
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/disagreement/live",
            params=client.clean_params(threshold=threshold, limit=limit)
        )


    @_tool()
    async def get_bookmaker_rankings(criteria: str = "recommendation") -> dict:
        """
        Get bookmakers ranked by a chosen criterion.

        Routes to GET /api/mcp/analytics/bookmakers/rankings
        (apiKeyAuth, requirePermission('stats')).

        Args:
            criteria: "recommendation" (default), "value", "sharpness",
                "reliability", "coverage", or "limits"

        Returns:
            dict: {success, data: {rankings: [{bookmaker, bestOddsFrequency,
                  avgHoldPercentage, sharpBookRating, sportsCovered,
                  recommendationScore}], criteria, count}}
        """
        return await client.make_request(
            "GET",
            "/mcp/analytics/bookmakers/rankings",
            params=client.clean_params(criteria=criteria)
        )


    @_tool()
    async def compare_bookmakers(books: str) -> dict:
        """
        Compare bookmakers side by side on stored performance metrics.

        Routes to GET /api/mcp/analytics/bookmakers/compare
        (apiKeyAuth, requirePermission('stats')).

        Args:
            books: Comma separated bookmaker keys
                   (e.g. "draftkings,fanduel,betmgm")

        Returns:
            dict: {success, data: [{bookmaker, bestOddsFrequency,
                  avgHoldPercentage, sharpBookRating, sportsCovered,
                  calculatedAt}]}

        Note: Metrics come from a daily job that runs at 02:00 UTC. Books that
        have not been computed yet are simply absent from the result.
        """
        return await client.make_request(
            "GET", "/mcp/analytics/bookmakers/compare", params={"books": books}
        )


    @_tool()
    async def get_bookmaker_metrics(bookmaker: str) -> dict:
        """
        Get full performance metrics for a single bookmaker.

        Routes to GET /api/mcp/analytics/bookmakers/:bookmaker
        (apiKeyAuth, requirePermission('stats')). Returns 404 when the daily
        analytics job has not yet computed a row for this book.

        Args:
            bookmaker: Bookmaker key (e.g. "draftkings", "fanduel")

        Returns:
            dict: {success, data: {bookmaker, bestOddsFrequency,
                  avgHoldPercentage, sharpBookRating, lineMoveSpeed,
                  sportsCovered, calculatedAt}}
        """
        return await client.make_request("GET", f"/mcp/analytics/bookmakers/{bookmaker}")

    return registered
