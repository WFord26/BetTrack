"""
ESPN API Handler
================
Handles requests to ESPN's public API endpoints.
"""

import aiohttp
import asyncio
import logging
from typing import Optional, Dict, List
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class ESPNAPIHandler:
    """Handler for ESPN API."""
    
    SITE_API = "https://site.api.espn.com"
    CORE_API = "https://sports.core.api.espn.com"
    WEB_API = "https://site.web.api.espn.com"
    CDN_API = "https://cdn.espn.com"
    
    def __init__(self):
        """Initialize ESPN API handler."""
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def _make_request(self, base_url: str, endpoint: str, params: Dict = None) -> Dict:
        """
        Make HTTP request to ESPN API.
        
        Args:
            base_url: Base URL for the API
            endpoint: API endpoint path
            params: Query parameters
        
        Returns:
            Response data as dictionary
        """
        url = f"{base_url}{endpoint}"
        session = await self._get_session()
        
        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "success": True,
                        "data": data
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
    
    def get_scoreboard(
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    def get_standings(
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    def get_teams(self, sport: str, league: str) -> Dict:
        """
        Get list of teams.
        
        Args:
            sport: Sport type
            league: League code
        
        Returns:
            Dictionary with teams list
        """
        endpoint = f"/apis/site/v2/sports/{sport}/{league}/teams"
        result = asyncio.run(self._make_request(self.SITE_API, endpoint))
        return result
    
    def get_team_details(
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    def get_team_schedule(
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    def get_news(self, sport: str, league: str, limit: int = 20) -> Dict:
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    def search(self, query: str, limit: int = 10) -> Dict:
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
        result = asyncio.run(self._make_request(self.WEB_API, endpoint, params))
        return result
    
    def get_game_summary(self, sport: str, league: str, event_id: str) -> Dict:
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
        result = asyncio.run(self._make_request(self.SITE_API, endpoint, params))
        return result
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
