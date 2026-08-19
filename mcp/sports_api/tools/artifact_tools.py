"""
Visual Artifact MCP Tools
=========================
Tools that return ready-to-render React artifacts or visual-rendering
instructions, rather than plain data. Both need `odds_handler`; neither
needs ESPN data.

`register_artifact_tools(mcp, odds_handler)` attaches every tool in this
module to the given FastMCP instance. `odds_handler` may be None when
ODDS_API_KEY is not configured; both tools below return an explanatory
error in that case.

The odds-card tool is split into three module-level helpers -- odds
extraction, best-price selection, and template rendering -- so the data
handling can be tested without standing up a server or an API client.
"""

import json
from datetime import datetime

from ..team_reference import get_team_logo_url

# Sport key -> league slug understood by get_team_logo_url(). Both tools in
# this module resolve logos, so the mapping lives here instead of being
# repeated inside each one.
_SPORT_LEAGUE_MAP = {
    "americanfootball_nfl": "nfl",
    "basketball_nba": "nba",
    "icehockey_nhl": "nhl",
}


def _league_for(sport: str) -> str:
    """Map an Odds API sport key to a league slug, defaulting to NFL."""
    return _SPORT_LEAGUE_MAP.get(sport, "nfl")


def _extract_book_odds(book: dict, home_team: str, away_team: str) -> dict:
    """Flatten one bookmaker's markets into a single row of odds.

    The Odds API nests each market (h2h/spreads/totals) as a list of outcomes
    keyed by team name, but the card template wants one flat record per book.
    Books routinely omit markets, so anything missing falls back to 0 (or the
    -110 standard juice) rather than raising.
    """
    markets = book.get("markets", [])

    # Moneyline
    h2h_market = next((m for m in markets if m.get("key") == "h2h"), None)
    ml_home = ml_away = 0
    if h2h_market:
        for outcome in h2h_market.get("outcomes", []):
            if outcome.get("name") == home_team:
                ml_home = outcome.get("price", 0)
            elif outcome.get("name") == away_team:
                ml_away = outcome.get("price", 0)

    # Spread, which carries its own juice per side
    spread_market = next((m for m in markets if m.get("key") == "spreads"), None)
    spread_home = spread_away = 0
    spread_home_juice = spread_away_juice = -110
    if spread_market:
        for outcome in spread_market.get("outcomes", []):
            if outcome.get("name") == home_team:
                spread_home = outcome.get("point", 0)
                spread_home_juice = outcome.get("price", -110)
            elif outcome.get("name") == away_team:
                spread_away = outcome.get("point", 0)
                spread_away_juice = outcome.get("price", -110)

    # Totals are keyed by "Over"/"Under" rather than by team, and both sides
    # share one line, so the line is read off whichever outcome carries it.
    totals_market = next((m for m in markets if m.get("key") == "totals"), None)
    total_line = total_over = total_under = 0
    if totals_market:
        outcomes = totals_market.get("outcomes", [])
        over_outcome = next((o for o in outcomes if o.get("name") == "Over"), None)
        under_outcome = next((o for o in outcomes if o.get("name") == "Under"), None)
        if over_outcome:
            total_line = over_outcome.get("point", 0)
            total_over = over_outcome.get("price", -110)
        if under_outcome:
            total_under = under_outcome.get("price", -110)

    return {
        "name": book.get("title", ""),
        "ml_home": ml_home,
        "ml_away": ml_away,
        "spread_home": spread_home,
        "spread_away": spread_away,
        "spread_home_juice": spread_home_juice,
        "spread_away_juice": spread_away_juice,
        "total_line": total_line,
        "total_over": total_over,
        "total_under": total_under,
    }


def _best_focus_odds(books_data: list, is_home: bool) -> tuple:
    """Return the best (moneyline, spread) across books for the focus team.

    Higher is better for both: a larger American moneyline pays more, and a
    larger spread point value is more favourable. A moneyline of 0 means the
    book did not price that side, so those are excluded -- note this also
    excludes genuine negative (favourite) prices, which is why a card for a
    favourite reports a best moneyline of 0.
    """
    side = "home" if is_home else "away"
    ml_key, spread_key = "ml_" + side, "spread_" + side

    best_ml = max([b[ml_key] for b in books_data if b[ml_key] > 0], default=0)
    best_spread = max([b[spread_key] for b in books_data], default=0)
    return best_ml, best_spread


def _render_odds_card(
    *,
    sport: str,
    commence_time: str,
    focus_team: str,
    other_team: str,
    focus_abbr: str,
    is_home: bool,
    focus_logo: str,
    other_logo: str,
    books_data: list,
    best_ml,
    best_spread,
) -> str:
    """Build the self-contained React component source for the odds card.

    `books_data` is embedded with json.dumps rather than str(): a Python repr
    is not JSON, and a book whose name contains an apostrophe (e.g.
    "Bally\'s Bet") would otherwise emit a component that will not parse.
    """
    return f"""export default function OddsCard() {{
  const gameTime = new Date('{commence_time}');
  const formattedTime = gameTime.toLocaleTimeString('en-US', {{ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }});

  const focusTeam = "{focus_team}";
  const otherTeam = "{other_team}";
  const isHome = {str(is_home).lower()};
  const focusLogo = "{focus_logo}";
  const otherLogo = "{other_logo}";

  const books = {json.dumps(books_data)};

  const bestML = {best_ml};
  const bestSpread = {best_spread};

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl max-w-2xl mx-auto font-sans">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-blue-500 text-white px-2 py-1 rounded">{sport.split('_')[1].upper()}</span>
          <span className="text-slate-400 text-sm">Upcoming</span>
        </div>
        <span className="text-slate-300 text-sm font-medium">{{formattedTime}}</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex-1 text-center">
          {{(isHome ? otherLogo : focusLogo) ? (
            <img
              src={{isHome ? otherLogo : focusLogo}}
              alt={{isHome ? otherTeam : focusTeam}}
              className="w-20 h-20 mx-auto mb-2 object-contain"
            />
          ) : (
            <div className="text-5xl mb-2">🏀</div>
          )}}
          <div className="text-white font-bold text-lg">{{isHome ? otherTeam.split(' ').slice(0, -1).join(' ') : focusTeam.split(' ').slice(0, -1).join(' ')}}</div>
          <div className="text-yellow-400 font-bold text-xl">{{(isHome ? otherTeam : focusTeam).split(' ').slice(-1)[0].toUpperCase()}}</div>
          <div className="text-slate-500 text-xs mt-1">{{isHome ? 'AWAY' : 'HOME'}}</div>
        </div>

        <div className="px-6">
          <div className="text-slate-500 text-2xl font-bold">@</div>
        </div>

        <div className="flex-1 text-center">
          {{(isHome ? focusLogo : otherLogo) ? (
            <img
              src={{isHome ? focusLogo : otherLogo}}
              alt={{isHome ? focusTeam : otherTeam}}
              className="w-20 h-20 mx-auto mb-2 object-contain"
            />
          ) : (
            <div className="text-5xl mb-2">🏀</div>
          )}}
          <div className="text-white font-bold text-lg">{{isHome ? focusTeam.split(' ').slice(0, -1).join(' ') : otherTeam.split(' ').slice(0, -1).join(' ')}}</div>
          <div className="text-green-400 font-bold text-xl">{{(isHome ? focusTeam : otherTeam).split(' ').slice(-1)[0].toUpperCase()}}</div>
          <div className="text-slate-500 text-xs mt-1">{{isHome ? 'HOME' : 'AWAY'}}</div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
        <div className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-semibold">Consensus Line</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-slate-500 text-xs mb-1">Spread</div>
            <div className="text-white font-bold text-lg">{focus_abbr} {{bestSpread > 0 ? '+' : ''}}{{bestSpread}}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Total</div>
            <div className="text-white font-bold text-lg">O/U {{books[0]?.total_line || 0}}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Moneyline</div>
            <div className="text-yellow-400 font-bold text-lg">{{bestML > 0 ? '+' : ''}}{{bestML}}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">Odds by Book</div>

        <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 px-2 mb-1">
          <div>Book</div>
          <div className="text-center">{focus_abbr} ML</div>
          <div className="text-center">Spread</div>
          <div className="text-center">Total</div>
        </div>

        {{books.map((book, i) => {{
          const focusML = isHome ? book.ml_home : book.ml_away;
          const focusSpread = isHome ? book.spread_home : book.spread_away;
          const focusJuice = isHome ? book.spread_home_juice : book.spread_away_juice;

          return (
            <div key={{i}} className="bg-slate-800/30 rounded-lg p-3 grid grid-cols-4 gap-2 items-center text-sm">
              <div className="text-slate-300 font-medium">{{book.name}}</div>
              <div className={{`text-center font-bold ${{focusML === bestML ? 'text-green-400' : 'text-white'}}`}}>
                {{focusML > 0 ? '+' : ''}}{{focusML}}
              </div>
              <div className={{`text-center ${{focusSpread === bestSpread ? 'text-green-400' : 'text-slate-300'}}`}}>
                {{focusSpread > 0 ? '+' : ''}}{{focusSpread}} <span className="text-slate-500 text-xs">({{focusJuice}})</span>
              </div>
              <div className="text-center text-slate-300">
                {{book.total_line}} <span className="text-slate-500 text-xs">(o{{book.total_over}})</span>
              </div>
            </div>
          );
        }})}}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
        <div className="text-slate-500 text-xs">
          Best {focus_abbr} ML: <span className="text-green-400 font-bold">{{bestML > 0 ? '+' : ''}}{{bestML}}</span>
        </div>
        <div className="text-slate-600 text-xs">Live odds</div>
      </div>
    </div>
  );
}}"""


def register_artifact_tools(mcp, odds_handler) -> None:
    """Attach the visual artifact tools to `mcp`.

    Args:
        mcp: A FastMCP server instance
        odds_handler: An OddsAPIHandler instance, or None if ODDS_API_KEY is
            not configured
    """

    @mcp.tool()
    async def get_odds_card_artifact(
        team_name: str,
        sport: str = "basketball_nba"
    ) -> dict:
        """
        Get a COMPLETE HTML artifact for an odds comparison card - ready to render immediately.
        Returns pre-built React component with real data embedded.

        Args:
            team_name: Team name to search for (e.g., "Nuggets", "Lakers", "Chiefs")
            sport: Sport key (basketball_nba, americanfootball_nfl, icehockey_nhl)

        Returns:
            Dictionary with complete HTML artifact string and render instruction

        Example:
            get_odds_card_artifact("Nuggets") -> Complete React card with Nuggets odds
            get_odds_card_artifact("Chiefs", "americanfootball_nfl") -> NFL odds card

        Note: This returns a COMPLETE artifact - Claude should render it directly, not rebuild
        """
        if not odds_handler:
            return {"error": "Odds API not configured. Please set ODDS_API_KEY environment variable."}

        # Search for team's game
        search_result = await odds_handler.search_odds(query=team_name, sport=sport)
        games = search_result.get("matching_games", [])

        if not games:
            return {
                "success": False,
                "error": f"No upcoming games found for '{team_name}'",
                "suggestion": "Try a different team name or check the sport parameter"
            }

        game = games[0]  # Get first matching game
        home_team = game.get("home_team", "")
        away_team = game.get("away_team", "")
        commence_time = game.get("commence_time", "")
        bookmakers = game.get("bookmakers", [])[:5]  # Top 5 bookmakers

        if not bookmakers:
            return {"success": False, "error": "No odds available for this game"}

        # The card is written from the perspective of the team the user asked
        # for, so everything below is labelled focus/other rather than
        # home/away.
        is_home = team_name.lower() in home_team.lower()
        focus_team = home_team if is_home else away_team
        other_team = away_team if is_home else home_team
        focus_abbr = focus_team.split()[-1].upper()[:3]

        league = _league_for(sport)
        home_logo = get_team_logo_url(home_team, league, size=500) or ""
        away_logo = get_team_logo_url(away_team, league, size=500) or ""
        focus_logo = home_logo if is_home else away_logo
        other_logo = away_logo if is_home else home_logo

        books_data = [
            _extract_book_odds(book, home_team, away_team) for book in bookmakers
        ]
        best_ml, best_spread = _best_focus_odds(books_data, is_home)

        artifact_html = _render_odds_card(
            sport=sport,
            commence_time=commence_time,
            focus_team=focus_team,
            other_team=other_team,
            focus_abbr=focus_abbr,
            is_home=is_home,
            focus_logo=focus_logo,
            other_logo=other_logo,
            books_data=books_data,
            best_ml=best_ml,
            best_spread=best_spread,
        )

        return {
            "success": True,
            "artifact_type": "react",
            "artifact_code": artifact_html,
            "game_info": {
                "home_team": home_team,
                "away_team": away_team,
                "commence_time": commence_time,
                "total_bookmakers": len(books_data)
            },
            "render_instruction": "IMPORTANT: Render the artifact_code directly as a React component. Do NOT rebuild from scratch. The template is pre-populated with real odds data.",
            "usage_note": "This is a complete, ready-to-render artifact with embedded data"
        }

    @mcp.tool()
    async def get_visual_scoreboard(
        sport: str = "americanfootball_nfl",
        include_odds: bool = True
    ) -> dict:
        """
        Get NFL/NBA/NHL games formatted for visual rendering as an interactive card.
        This tool returns structured data that Claude will render as a beautiful visual component.

        Args:
            sport: Sport key (americanfootball_nfl, basketball_nba, icehockey_nhl)
            include_odds: Whether to include betting odds (default: True)

        Returns:
            Structured data optimized for visual card rendering with instruction to create artifact

        Example:
            get_visual_scoreboard("americanfootball_nfl") -> Returns data for NFL scoreboard card
        """
        if not odds_handler:
            return {
                "success": False,
                "error": "Odds API not configured. Please set ODDS_API_KEY environment variable.",
                "render_instruction": "text"
            }

        # Fetch scores
        scores_result = await odds_handler.get_scores(sport=sport, days_from=3)
        games_data = scores_result.get("data", []) if scores_result.get("success") else []

        league = _league_for(sport)

        # Add logo URLs to games
        for game in games_data:
            home_team = game.get("home_team", "")
            away_team = game.get("away_team", "")

            game["home_team_logo"] = get_team_logo_url(home_team, league, size=500)
            game["away_team_logo"] = get_team_logo_url(away_team, league, size=500)

        # Fetch odds if requested
        if include_odds:
            odds_result = await odds_handler.get_odds(
                sport=sport,
                regions="us",
                markets="spreads,totals",
                odds_format="american"
            )
            odds_data = odds_result.get("data", []) if odds_result.get("success") else []

            # Merge odds into games data
            for game in games_data:
                game_id = game.get("id")
                matching_odds = next((o for o in odds_data if o.get("id") == game_id), None)
                if matching_odds:
                    game["bookmakers"] = matching_odds.get("bookmakers", [])

        # Format for visual rendering
        return {
            "success": True,
            "sport": sport,
            "games": games_data,
            "total_games": len(games_data),
            "last_updated": datetime.now().isoformat(),
            "render_instruction": "Please create an interactive React artifact displaying these games as a visual scoreboard with team colors, scores, and expandable betting odds. Use a card-based grid layout with smooth animations and hover effects. Style it similar to modern sports apps like ESPN or The Score.",
            "visual_hint": "scoreboard_card"
        }
