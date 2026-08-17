"""
Pytest configuration and shared fixtures for MCP tests

Provides:
- Mock API response fixtures using espn-api-spec.json and odds-api-spec.json
- Async test support via pytest-asyncio
- Common test data factories
"""

import pytest
import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock


# Load API spec fixtures
@pytest.fixture
def espn_api_spec():
    """Load ESPN API spec as fixture for mock responses"""
    spec_path = Path(__file__).parent.parent / "espn-api-spec.json"
    if spec_path.exists():
        with open(spec_path) as f:
            return json.load(f)
    return {}


@pytest.fixture
def odds_api_spec():
    """Load Odds API spec as fixture for mock responses"""
    spec_path = Path(__file__).parent.parent / "odds-api-spec.json"
    if spec_path.exists():
        with open(spec_path) as f:
            return json.load(f)
    return {}


@pytest.fixture
def sample_game_data():
    """Sample game data for testing"""
    return {
        "id": "test-game-123",
        "home_team": "Los Angeles Lakers",
        "away_team": "Boston Celtics",
        "home_score": 120,
        "away_score": 118,
        "status": "completed",
        "commence_time": "2026-01-15T20:00:00Z",
        "sport_key": "basketball_nba",
        "sport_name": "NBA",
        "league": "NBA",
        "home_team_id": "1",
        "away_team_id": "2",
    }


@pytest.fixture
def sample_odds_data():
    """Sample odds data for testing"""
    return {
        "id": "test-odds-123",
        "sport_key": "basketball_nba",
        "sport_title": "NBA",
        "commence_time": "2026-01-15T20:00:00Z",
        "home_team": "Los Angeles Lakers",
        "away_team": "Boston Celtics",
        "bookmakers": [
            {
                "key": "draftkings",
                "title": "DraftKings",
                "last_update": "2026-01-15T19:00:00Z",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "Los Angeles Lakers", "price": -110},
                            {"name": "Boston Celtics", "price": -110},
                        ],
                    }
                ],
            }
        ],
    }


@pytest.fixture
def sample_team_list():
    """Sample team data for testing"""
    return [
        {
            "id": "1",
            "name": "Los Angeles Lakers",
            "abbr": "LAL",
            "sport": "nba",
            "logo_url": "https://cdn.espn.com/media/nba/teams/logos/lal.png",
        },
        {
            "id": "2",
            "name": "Boston Celtics",
            "abbr": "BOS",
            "sport": "nba",
            "logo_url": "https://cdn.espn.com/media/nba/teams/logos/bos.png",
        },
    ]


@pytest.fixture
def async_mock():
    """Factory for creating AsyncMock objects"""
    def _async_mock(*args, **kwargs):
        mock = AsyncMock(*args, **kwargs)
        return mock
    return _async_mock


# Mark async tests
def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )


# Provide asyncio event loop for async tests
@pytest.fixture(scope="session")
def event_loop_policy():
    """Set event loop policy for async tests"""
    import asyncio
    if os.name == "nt":  # Windows
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    return asyncio.get_event_loop_policy()
