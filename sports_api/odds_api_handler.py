"""
The Odds API Handler
====================
Handles requests to The Odds API for betting odds and scores.
"""

import aiohttp
import asyncio
import logging
from typing import Optional, Dict, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class OddsAPIHandler:
    """Handler for The Odds API."""
    
    BASE_URL = "https://api.the-odds-api.com"
    
    def __init__(self, api_key: str):
        """
        Initialize Odds API handler.
        
        Args:
            api_key: The Odds API key
        """
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """
        Make HTTP request to The Odds API.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
        
        Returns:
            Response data as dictionary
        """
        if params is None:
            params = {}
        
        params["apiKey"] = self.api_key
        
        url = f"{self.BASE_URL}{endpoint}"
        session = await self._get_session()
        
        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Log usage information from headers
                    remaining = response.headers.get('x-requests-remaining')
                    used = response.headers.get('x-requests-used')
                    if remaining:
                        logger.info(f"API requests remaining: {remaining}")
                    
                    return {
                        "success": True,
                        "data": data,
                        "usage": {
                            "remaining": remaining,
                            "used": used
                        }
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"API error {response.status}: {error_text}")
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
    
    def get_sports(self, all_sports: bool = False) -> Dict:
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
        
        result = asyncio.run(self._make_request("/v4/sports", params))
        return result
    
    def get_odds(
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
        params = {
            "regions": regions,
            "oddsFormat": odds_format,
            "dateFormat": date_format
        }
        
        if markets:
            params["markets"] = markets
        
        endpoint = f"/v4/sports/{sport}/odds"
        result = asyncio.run(self._make_request(endpoint, params))
        return result
    
    def get_scores(self, sport: str, days_from: int = 3) -> Dict:
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
        result = asyncio.run(self._make_request(endpoint, params))
        return result
    
    def get_event_odds(
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
        params = {
            "regions": regions,
            "oddsFormat": odds_format
        }
        
        if markets:
            params["markets"] = markets
        
        endpoint = f"/v4/sports/{sport}/events/{event_id}/odds"
        result = asyncio.run(self._make_request(endpoint, params))
        return result
    
    def search_odds(
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
        # If sport specified, get odds for that sport
        # Otherwise, get odds for multiple popular sports
        sports_to_check = []
        
        if sport:
            sports_to_check = [sport]
        else:
            # Check popular sports
            sports_to_check = [
                "americanfootball_nfl",
                "basketball_nba",
                "baseball_mlb",
                "icehockey_nhl"
            ]
        
        query_lower = query.lower()
        matching_games = []
        
        for sport_key in sports_to_check:
            odds_result = self.get_odds(
                sport=sport_key,
                regions=regions,
                markets=markets
            )
            
            if odds_result.get("success") and odds_result.get("data"):
                for game in odds_result["data"]:
                    home_team = game.get("home_team", "").lower()
                    away_team = game.get("away_team", "").lower()
                    
                    # Check if query matches either team
                    if query_lower in home_team or query_lower in away_team:
                        matching_games.append({
                            "sport": sport_key,
                            **game
                        })
        
        return {
            "success": True,
            "query": query,
            "matching_games": matching_games,
            "count": len(matching_games)
        }
    
    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()
