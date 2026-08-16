"""
The Odds API Handler
====================
Handles requests to The Odds API for betting odds and scores.

Two quota protections sit in front of every request:

* A TTL cache (`sports_api.cache`) so repeated questions inside one
  conversation do not each cost a request against the monthly allowance.
* Failure aware key rotation (`sports_api.key_manager`) so a dead or drained
  key is retired instead of being retried on a fixed cycle.
"""

import aiohttp
import asyncio
import logging
from typing import Optional, Dict, List, Union
from datetime import datetime, timedelta

from .cache import ResponseCache, make_key
from .key_manager import APIKeyManager
from .team_matching import DEFAULT_SEARCH_SPORTS, guess_sport_key, team_matches

logger = logging.getLogger(__name__)

# Per-endpoint cache lifetimes, in seconds. Odds move continuously, so these
# stay short enough that a quoted price is never materially stale, while still
# absorbing the repeat questions that dominate a conversation.
DEFAULT_TTLS = {
    "sports": 3600,   # the sports list changes a few times a year
    "odds": 60,
    "scores": 60,
    "event_odds": 60,
}


class OddsAPIHandler:
    """Handler for The Odds API."""

    BASE_URL = "https://api.the-odds-api.com"

    def __init__(
        self,
        api_key: Union[str, List[str]],
        bookmakers_filter: Optional[List[str]] = None,
        bookmakers_limit: int = 5,
        cache: Optional[ResponseCache] = None,
        ttls: Optional[Dict[str, int]] = None,
    ):
        """
        Initialize Odds API handler.

        Args:
            api_key: The Odds API key (single key, or a list for rotation)
            bookmakers_filter: Optional list of bookmaker keys to include (e.g., ['draftkings', 'fanduel'])
            bookmakers_limit: Maximum number of bookmakers to return per game (default: 5)
            cache: Optional shared ResponseCache. One is created if omitted.
            ttls: Optional per-endpoint TTL overrides, merged over DEFAULT_TTLS
        """
        keys = [api_key] if isinstance(api_key, str) else list(api_key)
        self.key_manager = APIKeyManager(keys)

        self.session: Optional[aiohttp.ClientSession] = None
        self.bookmakers_filter = [bm.lower() for bm in bookmakers_filter] if bookmakers_filter else None
        self.bookmakers_limit = bookmakers_limit

        self.cache = cache if cache is not None else ResponseCache()
        self.ttls = {**DEFAULT_TTLS, **(ttls or {})}

    @property
    def api_keys(self) -> List[str]:
        """The configured keys. Retained for backwards compatibility."""
        return [state.key for state in self.key_manager.states]

    def get_key_status(self) -> Dict:
        """Quota and health per key, with the keys themselves masked."""
        return self.key_manager.status()

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    @staticmethod
    def _is_cacheable(result: Dict) -> bool:
        """Only successful responses are worth storing.

        Caching an error would convert a momentary upstream blip into a full
        TTL window of guaranteed failure.
        """
        return bool(result.get("success"))

    async def _make_request(
        self,
        endpoint: str,
        params: Dict = None,
        cache_kind: str = "odds",
    ) -> Dict:
        """
        Make an HTTP request to The Odds API, serving from cache when possible.

        Args:
            endpoint: API endpoint path
            params: Query parameters (the API key is added internally)
            cache_kind: Which TTL bucket to use (see DEFAULT_TTLS)

        Returns:
            Response data as dictionary. On a cache hit the payload carries
            `"cached": True` so callers can tell it cost no quota.
        """
        params = dict(params or {})

        # The API key is deliberately excluded from the cache key: the payload
        # is the same whichever key fetched it, and including it would throw
        # the cache away on every rotation.
        key = make_key("odds", endpoint, params)
        ttl = self.ttls.get(cache_kind, 60)

        result, was_hit = await self.cache.get_or_fetch(
            key,
            ttl,
            lambda: self._fetch(endpoint, params),
            should_cache=self._is_cacheable,
        )

        if was_hit:
            # Copy before annotating so the stored entry stays clean.
            result = {**result, "cached": True}

        return result

    async def _fetch(self, endpoint: str, params: Dict) -> Dict:
        """Perform one live request, rotating keys on an unusable key."""
        url = f"{self.BASE_URL}{endpoint}"
        session = await self._get_session()

        # At most one retry per key, so a run of dead keys cannot loop forever.
        attempts_left = len(self.key_manager.states)

        while attempts_left > 0:
            attempts_left -= 1

            api_key = self.key_manager.get_key()
            if api_key is None:
                status = self.key_manager.status()
                logger.error("All Odds API keys are exhausted or invalid")
                return {
                    "success": False,
                    "error": "All Odds API keys are exhausted or invalid",
                    "key_status": status,
                }

            request_params = {**params, "apiKey": api_key}

            try:
                async with session.get(url, params=request_params) as response:
                    if response.status == 200:
                        data = await response.json()

                        remaining = response.headers.get("x-requests-remaining")
                        used = response.headers.get("x-requests-used")
                        self.key_manager.report_success(api_key, remaining, used)

                        if remaining is not None:
                            logger.info(f"API requests remaining: {remaining}")

                        return {
                            "success": True,
                            "data": data,
                            "cached": False,
                            "usage": {
                                "remaining": remaining,
                                "used": used,
                            },
                        }

                    error_text = await response.text()
                    outcome = self.key_manager.report_failure(
                        api_key, response.status, error_text
                    )

                    # A key problem is worth retrying on the next key; anything
                    # else is the API's fault and retrying just burns quota.
                    if outcome in ("exhausted", "invalid") and self.key_manager.has_usable_key():
                        logger.info(
                            "Retrying request on the next Odds API key after %s", outcome
                        )
                        continue

                    logger.error(f"API error {response.status}: {error_text}")
                    return {
                        "success": False,
                        "error": f"API returned status {response.status}",
                        "details": error_text,
                    }

            except Exception as e:
                logger.error(f"Request failed: {str(e)}")
                return {"success": False, "error": str(e)}

        return {
            "success": False,
            "error": "All Odds API keys are exhausted or invalid",
            "key_status": self.key_manager.status(),
        }
    
    def _filter_bookmakers(self, data: Dict) -> Dict:
        """
        Filter bookmakers in API response data based on configured filters.

        This returns a NEW structure rather than editing in place. Responses
        are cached, and mutating one would rewrite the cached entry: a later
        hit would then be filtered a second time, and any caller holding the
        unfiltered response would see it change underneath them.

        Args:
            data: API response data containing games with bookmakers

        Returns:
            A copy of `data` with each game's bookmakers filtered and limited
        """
        if not isinstance(data, dict) or "data" not in data:
            return data

        games = data.get("data", [])
        if not isinstance(games, list):
            return data

        filtered_games = []
        for game in games:
            if not isinstance(game, dict):
                filtered_games.append(game)
                continue

            bookmakers = game.get("bookmakers")
            if not isinstance(bookmakers, list):
                filtered_games.append(game)
                continue

            if self.bookmakers_filter:
                bookmakers = [
                    bm for bm in bookmakers
                    if bm.get("key", "").lower() in self.bookmakers_filter
                ]
                logger.debug(f"Filtered to {len(bookmakers)} bookmakers from filter list")

            if self.bookmakers_limit:
                bookmakers = bookmakers[:self.bookmakers_limit]

            # Shallow copy of the game with a fresh bookmakers list. The
            # bookmaker dicts themselves are shared but never written to.
            filtered_games.append({**game, "bookmakers": bookmakers})

        return {**data, "data": filtered_games}
    
    async def get_sports(self, all_sports: bool = False) -> Dict:
        """
        Get list of available sports.
        
        Args:
            all_sports: If False, returns only in-season sports
        
        Returns:
            Dictionary with sports list
        """
        params = {}
        if all_sports:
            params["all"] = "true"
        
        result = await self._make_request("/v4/sports", params, cache_kind="sports")
        return result
    
    async def get_odds(
        self,
        sport: str,
        regions: str = "us",
        markets: Optional[str] = None,
        odds_format: str = "american",
        date_format: str = "iso"
    ) -> Dict:
        """
        Get odds for upcoming games.
        
        Args:
            sport: Sport key
            regions: Comma-separated regions (us, us2, uk, au, eu)
            markets: Comma-separated markets (h2h, spreads, totals)
            odds_format: american, decimal, or fractional
            date_format: iso or unix
        
        Returns:
            Dictionary with odds data
        """
        # The API defaults to h2h when markets is omitted. Sending it
        # explicitly means get_odds(sport) and get_odds(sport, markets="h2h")
        # produce one cache entry instead of two identical ones.
        params = {
            "regions": regions,
            "oddsFormat": odds_format,
            "dateFormat": date_format,
            "markets": markets or "h2h",
        }

        endpoint = f"/v4/sports/{sport}/odds"
        result = await self._make_request(endpoint, params, cache_kind="odds")
        
        # Filter bookmakers if configured
        if result.get("success"):
            result = self._filter_bookmakers(result)
        
        return result
    
    async def get_scores(self, sport: str, days_from: int = 3) -> Dict:
        """
        Get scores for recent, live, and upcoming games.
        
        Args:
            sport: Sport key
            days_from: Number of days from today (max 3)
        
        Returns:
            Dictionary with scores
        """
        params = {
            "daysFrom": min(days_from, 3)
        }
        
        endpoint = f"/v4/sports/{sport}/scores"
        result = await self._make_request(endpoint, params, cache_kind="scores")
        return result
    
    async def get_event_odds(
        self,
        sport: str,
        event_id: str,
        regions: str = "us",
        markets: Optional[str] = None,
        odds_format: str = "american"
    ) -> Dict:
        """
        Get odds for a specific event.
        
        Args:
            sport: Sport key
            event_id: Event ID
            regions: Comma-separated regions
            markets: Comma-separated markets
            odds_format: american, decimal, or fractional
        
        Returns:
            Dictionary with event odds
        """
        # Explicit default, for the same cache-key reason as get_odds.
        params = {
            "regions": regions,
            "oddsFormat": odds_format,
            "markets": markets or "h2h",
        }

        endpoint = f"/v4/sports/{sport}/events/{event_id}/odds"
        result = await self._make_request(endpoint, params, cache_kind="event_odds")
        
        # Filter bookmakers if configured
        if result.get("success"):
            # For single event, wrap in data array for filtering
            if "data" not in result and isinstance(result.get("bookmakers"), list):
                temp_result = {"success": True, "data": [result]}
                temp_result = self._filter_bookmakers(temp_result)
                if temp_result.get("data"):
                    result = {**result, "bookmakers": temp_result["data"][0].get("bookmakers", [])}
            else:
                result = self._filter_bookmakers(result)
        
        return result
    
    async def search_odds(
        self,
        query: str,
        sport: Optional[str] = None,
        regions: str = "us",
        markets: str = "h2h"
    ) -> Dict:
        """
        Search for odds matching a natural language query.
        
        Args:
            query: Search query (team name, matchup, etc.)
            sport: Optional sport filter
            regions: Bookmaker regions
            markets: Markets to include
        
        Returns:
            Dictionary with matching games and odds
        """
        if sport:
            sports_to_check = [sport]
        else:
            # Without a sport filter this used to request all four leagues
            # every time, so one question cost four requests against a 500 a
            # month allowance. Guess the league from the team name first and
            # only fan out when the guess fails.
            guessed = guess_sport_key(query)
            if guessed:
                sports_to_check = [guessed]
                logger.info(f"Inferred sport '{guessed}' from query '{query}'")
            else:
                sports_to_check = list(DEFAULT_SEARCH_SPORTS)
                logger.info(
                    f"Could not infer a league from '{query}'; checking "
                    f"{len(sports_to_check)} sports (cached responses cost nothing)"
                )

        matching_games = []
        sports_searched = []
        errors = []

        for sport_key in sports_to_check:
            odds_result = await self.get_odds(
                sport=sport_key,
                regions=regions,
                markets=markets
            )
            sports_searched.append(sport_key)

            if not odds_result.get("success"):
                errors.append({
                    "sport": sport_key,
                    "error": odds_result.get("error", "unknown error"),
                })
                continue

            for game in odds_result.get("data") or []:
                if team_matches(query, game.get("home_team", "")) or \
                        team_matches(query, game.get("away_team", "")):
                    matching_games.append({"sport": sport_key, **game})

            # A guess that found nothing is probably a wrong guess, so fall
            # back to the full sweep rather than reporting "no games".
            if not matching_games and not sport and len(sports_to_check) == 1:
                remaining = [s for s in DEFAULT_SEARCH_SPORTS if s != sport_key]
                logger.info(
                    f"Inferred sport returned no match for '{query}'; "
                    f"falling back to the remaining {len(remaining)} sports"
                )
                sports_to_check.extend(remaining)

        result = {
            "success": True,
            "query": query,
            "matching_games": matching_games,
            "count": len(matching_games),
            "sports_searched": sports_searched,
        }

        if errors:
            result["partial_errors"] = errors

        return result
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
