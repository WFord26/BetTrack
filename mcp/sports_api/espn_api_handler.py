"""
ESPN API Handler
================
Handles requests to ESPN's public API endpoints.

ESPN needs no API key, so caching here is about latency and politeness rather
than quota: several tools fan out to the same scoreboard, and without a cache
each one issues its own request for identical data.
"""

import aiohttp
import asyncio
import logging
from typing import Optional, Dict, List
from urllib.parse import urlencode

from .cache import ResponseCache, make_key

logger = logging.getLogger(__name__)

# Cache lifetimes by endpoint kind, in seconds. Live scores need to stay
# fresh; rosters and team lists change on the order of days.
DEFAULT_TTLS = {
    "scoreboard": 30,
    "summary": 30,
    "standings": 300,
    "news": 300,
    "schedule": 600,
    "search": 600,
    "teams": 86400,
    "team_details": 3600,
}

# Matched against the endpoint path, first hit wins.
_ENDPOINT_KINDS = (
    ("/scoreboard", "scoreboard"),
    ("/summary", "summary"),
    ("/standings", "standings"),
    ("/news", "news"),
    ("/schedule", "schedule"),
    ("/search", "search"),
)


class ESPNAPIHandler:
    """Handler for ESPN API."""

    SITE_API = "https://site.api.espn.com"
    CORE_API = "https://sports.core.api.espn.com"
    WEB_API = "https://site.web.api.espn.com"
    CDN_API = "https://cdn.espn.com"

    def __init__(
        self,
        cache: Optional[ResponseCache] = None,
        ttls: Optional[Dict[str, int]] = None,
    ):
        """Initialize ESPN API handler.

        Args:
            cache: Optional shared ResponseCache. One is created if omitted.
            ttls: Optional per-endpoint TTL overrides, merged over DEFAULT_TTLS
        """
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache = cache if cache is not None else ResponseCache()
        self.ttls = {**DEFAULT_TTLS, **(ttls or {})}

    def _ttl_for(self, endpoint: str) -> int:
        """Pick a TTL from the endpoint path.

        `/teams/{id}` is a team detail lookup while a bare `/teams` is the
        league list, and the two change at very different rates.
        """
        for needle, kind in _ENDPOINT_KINDS:
            if needle in endpoint:
                return self.ttls.get(kind, 60)

        if "/teams/" in endpoint:
            return self.ttls.get("team_details", 3600)
        if endpoint.endswith("/teams"):
            return self.ttls.get("teams", 86400)

        return 60

    @staticmethod
    def _is_cacheable(result: Dict) -> bool:
        """Never cache a failure; a blip would become a full TTL of failure."""
        return bool(result.get("success"))
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def _make_request(self, base_url: str, endpoint: str, params: Dict = None) -> Dict:
        """
        Make HTTP request to ESPN API, serving from cache when possible.

        Args:
            base_url: Base URL for the API
            endpoint: API endpoint path
            params: Query parameters

        Returns:
            Response data as dictionary. Cache hits carry `"cached": True`.
        """
        params = dict(params or {})
        key = make_key("espn", base_url, endpoint, params)

        result, was_hit = await self.cache.get_or_fetch(
            key,
            self._ttl_for(endpoint),
            lambda: self._fetch(base_url, endpoint, params),
            should_cache=self._is_cacheable,
        )

        if was_hit:
            result = {**result, "cached": True}

        return result

    async def _fetch(self, base_url: str, endpoint: str, params: Dict = None) -> Dict:
        """Perform one live request against ESPN."""
        url = f"{base_url}{endpoint}"
        session = await self._get_session()

        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "success": True,
                        "data": data,
                        "cached": False
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"ESPN API error {response.status}: {error_text}")
                    return {
                        "success": False,
                        "error": f"API returned status {response.status}",
                        "details": error_text
                    }
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_scoreboard(
        self,
        sport: str,
        league: str,
        date: Optional[str] = None,
        limit: int = 50
    ) -> Dict:
        """
        Get scoreboard for a sport/league.
        
        Args:
            sport: Sport type (football, basketball, baseball, hockey, soccer)
            league: League code (nfl, nba, mlb, nhl, etc.)
            date: Optional date in YYYYMMDD format
            limit: Maximum number of games
        
        Returns:
            Dictionary with scoreboard data
        """
        params = {"limit": limit}
        if date:
            params["dates"] = date
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/scoreboard"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def get_standings(
        self,
        sport: str,
        league: str,
        season: Optional[int] = None
    ) -> Dict:
        """
        Get league standings.
        
        Args:
            sport: Sport type
            league: League code
            season: Optional season year
        
        Returns:
            Dictionary with standings data
        """
        params = {}
        if season:
            params["season"] = season
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/standings"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def get_teams(self, sport: str, league: str) -> Dict:
        """
        Get list of teams.
        
        Args:
            sport: Sport type
            league: League code
        
        Returns:
            Dictionary with teams list
        """
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/teams"
        result = await self._make_request(self.SITE_API, endpoint)
        return result
    
    async def get_team_details(
        self,
        sport: str,
        league: str,
        team_id: str,
        include_roster: bool = False
    ) -> Dict:
        """
        Get team details.
        
        Args:
            sport: Sport type
            league: League code
            team_id: Team ID
            include_roster: Whether to include roster
        
        Returns:
            Dictionary with team details
        """
        params = {}
        if include_roster:
            params["enable"] = "roster,projection,stats"
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/teams/{team_id}"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def get_team_schedule(
        self,
        sport: str,
        league: str,
        team_id: str,
        season: Optional[int] = None
    ) -> Dict:
        """
        Get team schedule.
        
        Args:
            sport: Sport type
            league: League code
            team_id: Team ID
            season: Optional season year
        
        Returns:
            Dictionary with team schedule
        """
        params = {}
        if season:
            params["season"] = season
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/teams/{team_id}/schedule"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def get_news(self, sport: str, league: str, limit: int = 20) -> Dict:
        """
        Get news articles.
        
        Args:
            sport: Sport type
            league: League code
            limit: Maximum number of articles
        
        Returns:
            Dictionary with news articles
        """
        params = {"limit": limit}
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/news"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def search(self, query: str, limit: int = 10) -> Dict:
        """
        Search ESPN.
        
        Args:
            query: Search query
            limit: Maximum results
        
        Returns:
            Dictionary with search results
        """
        params = {
            "query": query,
            "limit": limit
        }
        
        endpoint = "/apis/common/v3/search"
        result = await self._make_request(self.WEB_API, endpoint, params)
        return result
    
    async def get_game_summary(self, sport: str, league: str, event_id: str) -> Dict:
        """
        Get detailed game summary.
        
        Args:
            sport: Sport type
            league: League code
            event_id: Event/Game ID
        
        Returns:
            Dictionary with game summary
        """
        params = {"event": event_id}
        
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/summary"
        result = await self._make_request(self.SITE_API, endpoint, params)
        return result
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
