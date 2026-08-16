# MCP Server Test Suite

## Structure

```
mcp/tests/
├── __init__.py           # Package initialization
├── conftest.py           # Pytest configuration and fixtures
├── test_formatters.py    # Tests for formatter.py (pure functions)
├── test_team_reference.py # Tests for team_reference.py (lookups, fuzzy matching)
├── test_odds_api_handler.py  # [TODO] Tests for odds API integration
├── test_espn_api_handler.py  # [TODO] Tests for ESPN API integration
└── test_mcp_tools.py     # [TODO] Integration tests for @mcp.tool() functions
```

## Current Coverage

### ✅ Implemented

1. **test_formatters.py** (573 lines of formatter code)
   - Matchup card ASCII formatting (width, team name shortening, scores)
   - Scoreboard table markdown formatting (structure, emoji indicators)
   - Standings table (division grouping, win percentages)
   - Odds comparison table (bookmaker formatting, line movement)

2. **test_team_reference.py** (216 lines of team data)
   - Exact and partial team name matching
   - Case-insensitive lookups
   - Abbreviation matching
   - Fuzzy matching with typos
   - Logo URL generation (ESPN CDN, 500px format)
   - Data structure integrity (all teams have required fields)
   - Team count validation (30 NBA, 32 NFL, 32 NHL)

3. **conftest.py** - Pytest fixtures
   - `espn_api_spec`: Load ESPN API spec as mock data
   - `odds_api_spec`: Load Odds API spec as mock data
   - `sample_game_data`: Test game fixture
   - `sample_odds_data`: Test odds fixture
   - `sample_team_list`: Test team list fixture
   - `async_mock`: Factory for AsyncMock objects
   - Async test support via pytest-asyncio

### 🔄 TODO (Phase 2 extension)

1. **test_odds_api_handler.py** (to be implemented)
   - Mock Odds API responses using `odds-api-spec.json`
   - Test API key round-robin rotation
   - Test bookmaker filtering
   - Test rate limit tracking
   - Test error handling and retries

2. **test_espn_api_handler.py** (to be implemented)
   - Mock ESPN API responses using `espn-api-spec.json`
   - Test scoreboard fetching
   - Test standings fetching
   - Test team lookups

3. **test_mcp_tools.py** (to be implemented)
   - Integration tests for `@mcp.tool()` decorated functions
   - Test natural language search
   - Test tool parameter validation
   - Test output formatting in tool responses

## Setup

### Requirements

Python 3.11+ (FastMCP requirement)

```bash
cd mcp

# Install development dependencies
pip install -r requirements-dev.txt
```

### Running Tests

```bash
# All tests with verbose output
pytest tests/ -v

# Specific test file
pytest tests/test_formatters.py -v

# With coverage report
pytest tests/ --cov=sports_api --cov-report=html

# Run only formatter tests
pytest tests/test_formatters.py::TestMatchupCard -v
```

### Test Markers

```bash
# Run only async tests
pytest tests/ -m asyncio -v

# Run only unit tests
pytest tests/ -m unit -v

# Run only API tests
pytest tests/ -m api -v

# Run without async tests
pytest tests/ -m "not asyncio" -v
```

## Target Coverage

**Current Phase 1 (Implemented):**
- Formatters: 100% (pure functions, all paths covered)
- Team Reference: 95%+ (lookups, matching, logo generation)

**Phase 2 Extension (TODO):**
- API Handlers: 50%+ (mock responses, error paths)
- MCP Tools: 30%+ (basic functionality, common paths)

**Overall Target:** 50% coverage on `sports_api/` before touching `sports_mcp_server.py`

## Notes

- Tests use recorded API specs (`espn-api-spec.json`, `odds-api-spec.json`) for reproducible fixtures
- No external API calls during testing (fully mocked)
- Async tests use `pytest-asyncio` with `asyncio_mode = auto`
- Tests are grouped by module and feature using pytest classes
- Fixtures are centralized in `conftest.py` for reuse across test files
