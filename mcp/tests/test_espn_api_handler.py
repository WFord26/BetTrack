"""
Tests for sports_api/espn_api_handler.py

Mocks the underlying aiohttp session with aioresponses so no real network
calls are made.
"""

import pytest
from aioresponses import aioresponses

from sports_api.espn_api_handler import ESPNAPIHandler


@pytest.fixture
def handler():
    h = ESPNAPIHandler()
    yield h


class TestGetScoreboard:
    @pytest.mark.asyncio
    async def test_success(self, handler):
        url_re = r"^https://site\.api\.espn\.com/apis/site/v2/sports/basketball/nba/scoreboard.*"
        with aioresponses() as mocked:
            mocked.get(
                __import__("re").compile(url_re),
                payload={"events": [{"id": "1"}]},
                status=200,
            )
            result = await handler.get_scoreboard("basketball", "nba")

        assert result["success"] is True
        assert result["data"]["events"][0]["id"] == "1"
        await handler.close()

    @pytest.mark.asyncio
    async def test_non_200_returns_failure(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.api\.espn\.com/.*"),
                status=500,
                body="server error",
            )
            result = await handler.get_scoreboard("basketball", "nba")

        assert result["success"] is False
        assert "500" in result["error"]
        await handler.close()

    @pytest.mark.asyncio
    async def test_result_is_cached_on_second_call(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.api\.espn\.com/.*"),
                payload={"events": []},
                status=200,
            )
            first = await handler.get_scoreboard("basketball", "nba", date="20260101")
            second = await handler.get_scoreboard("basketball", "nba", date="20260101")

        assert first.get("cached") is False
        assert second.get("cached") is True
        await handler.close()


class TestTtlSelection:
    def test_scoreboard_endpoint_uses_scoreboard_ttl(self, handler):
        assert handler._ttl_for("/apis/site/v2/sports/basketball/nba/scoreboard") == 30

    def test_bare_teams_endpoint_uses_long_ttl(self, handler):
        assert handler._ttl_for("/apis/site/v2/sports/basketball/nba/teams") == 86400

    def test_team_detail_endpoint_uses_shorter_ttl(self, handler):
        assert handler._ttl_for("/apis/site/v2/sports/basketball/nba/teams/13") == 3600

    def test_unmatched_endpoint_falls_back_to_default(self, handler):
        assert handler._ttl_for("/some/unknown/path") == 60


class TestOtherEndpoints:
    @pytest.mark.asyncio
    async def test_get_teams(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.api\.espn\.com/.*/teams.*"),
                payload={"sports": []},
                status=200,
            )
            result = await handler.get_teams("basketball", "nba")

        assert result["success"] is True
        await handler.close()

    @pytest.mark.asyncio
    async def test_get_news(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.api\.espn\.com/.*/news.*"),
                payload={"articles": []},
                status=200,
            )
            result = await handler.get_news("basketball", "nba", limit=5)

        assert result["success"] is True
        await handler.close()

    @pytest.mark.asyncio
    async def test_search(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.web\.api\.espn\.com/.*"),
                payload={"results": []},
                status=200,
            )
            result = await handler.search("lakers")

        assert result["success"] is True
        await handler.close()

    @pytest.mark.asyncio
    async def test_request_exception_returns_failure(self, handler):
        import re

        with aioresponses() as mocked:
            mocked.get(
                re.compile(r"^https://site\.api\.espn\.com/.*"),
                exception=ConnectionError("network down"),
            )
            result = await handler.get_scoreboard("basketball", "nba")

        assert result["success"] is False
        assert "network down" in result["error"]
        await handler.close()
