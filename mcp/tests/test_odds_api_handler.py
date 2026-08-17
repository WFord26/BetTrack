"""
Tests for sports_api/odds_api_handler.py

Mocks the underlying aiohttp session with aioresponses so no real Odds API
requests are made.
"""

import re

import pytest
from aioresponses import aioresponses

from sports_api.odds_api_handler import OddsAPIHandler

ODDS_URL_RE = re.compile(r"^https://api\.the-odds-api\.com/.*")


@pytest.fixture
def handler():
    return OddsAPIHandler(api_key="test-key-1")


class TestGetOdds:
    @pytest.mark.asyncio
    async def test_success(self, handler):
        with aioresponses() as mocked:
            mocked.get(
                ODDS_URL_RE,
                payload=[{"home_team": "Lakers", "away_team": "Celtics", "bookmakers": []}],
                status=200,
                headers={"x-requests-remaining": "499", "x-requests-used": "1"},
            )
            result = await handler.get_odds("basketball_nba")

        assert result["success"] is True
        assert result["data"][0]["home_team"] == "Lakers"
        assert handler.key_manager.active.remaining == 499
        await handler.close()

    @pytest.mark.asyncio
    async def test_bookmakers_filtered(self):
        handler = OddsAPIHandler(api_key="test-key-1", bookmakers_filter=["draftkings"])
        payload = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "bookmakers": [
                    {"key": "draftkings", "title": "DraftKings"},
                    {"key": "fanduel", "title": "FanDuel"},
                ],
            }
        ]
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, payload=payload, status=200)
            result = await handler.get_odds("basketball_nba")

        bookmakers = result["data"][0]["bookmakers"]
        assert len(bookmakers) == 1
        assert bookmakers[0]["key"] == "draftkings"
        await handler.close()

    @pytest.mark.asyncio
    async def test_bookmakers_limit(self):
        handler = OddsAPIHandler(api_key="test-key-1", bookmakers_limit=1)
        payload = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "bookmakers": [
                    {"key": "draftkings", "title": "DraftKings"},
                    {"key": "fanduel", "title": "FanDuel"},
                ],
            }
        ]
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, payload=payload, status=200)
            result = await handler.get_odds("basketball_nba")

        assert len(result["data"][0]["bookmakers"]) == 1
        await handler.close()


class TestKeyRotationOnFailure:
    @pytest.mark.asyncio
    async def test_retries_next_key_on_429(self):
        handler = OddsAPIHandler(api_key=["bad-key", "good-key"])

        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, status=429, body="rate limited")
            mocked.get(
                ODDS_URL_RE,
                payload=[{"home_team": "Lakers", "away_team": "Celtics", "bookmakers": []}],
                status=200,
            )
            result = await handler.get_odds("basketball_nba")

        assert result["success"] is True
        assert handler.key_manager.states[0].status == "exhausted"
        assert handler.key_manager.active.key == "good-key"
        await handler.close()

    @pytest.mark.asyncio
    async def test_all_keys_exhausted_returns_failure(self):
        handler = OddsAPIHandler(api_key=["key1", "key2"])

        # Both keys get one attempt each; once both are exhausted the loop
        # stops retrying and surfaces the last response's status.
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, status=429, body="rate limited")
            mocked.get(ODDS_URL_RE, status=429, body="rate limited")
            result = await handler.get_odds("basketball_nba")

        assert result["success"] is False
        assert not handler.key_manager.has_usable_key()
        assert all(s.status == "exhausted" for s in handler.key_manager.states)
        await handler.close()

    @pytest.mark.asyncio
    async def test_server_error_not_retried_as_key_problem(self, handler):
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, status=503, body="server error")
            result = await handler.get_odds("basketball_nba")

        assert result["success"] is False
        assert handler.key_manager.active.status == "healthy"
        await handler.close()


class TestGetScores:
    @pytest.mark.asyncio
    async def test_days_from_capped_at_3(self, handler):
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, payload=[], status=200)
            result = await handler.get_scores("basketball_nba", days_from=10)

        assert result["success"] is True
        await handler.close()


class TestSearchOdds:
    @pytest.mark.asyncio
    async def test_infers_sport_from_query(self, handler):
        with aioresponses() as mocked:
            mocked.get(
                ODDS_URL_RE,
                payload=[
                    {
                        "home_team": "Los Angeles Lakers",
                        "away_team": "Boston Celtics",
                        "bookmakers": [],
                    }
                ],
                status=200,
            )
            result = await handler.search_odds("Lakers")

        assert result["success"] is True
        assert result["sports_searched"] == ["basketball_nba"]
        assert result["count"] == 1
        await handler.close()

    @pytest.mark.asyncio
    async def test_explicit_sport_skips_inference(self, handler):
        with aioresponses() as mocked:
            mocked.get(
                ODDS_URL_RE,
                payload=[
                    {
                        "home_team": "Los Angeles Lakers",
                        "away_team": "Boston Celtics",
                        "bookmakers": [],
                    }
                ],
                status=200,
            )
            result = await handler.search_odds("Lakers", sport="basketball_nba")

        assert result["sports_searched"] == ["basketball_nba"]
        await handler.close()

    @pytest.mark.asyncio
    async def test_no_match_reports_zero_count(self, handler):
        with aioresponses() as mocked:
            mocked.get(ODDS_URL_RE, payload=[], status=200)
            result = await handler.search_odds("Nonexistent Team", sport="basketball_nba")

        assert result["success"] is True
        assert result["count"] == 0
        await handler.close()


class TestGetKeyStatus:
    def test_returns_masked_status(self, handler):
        status = handler.get_key_status()
        assert status["total_keys"] == 1
        assert "key" not in status  # top-level shape check
        assert status["keys"][0]["key"] != "test-key-1"
