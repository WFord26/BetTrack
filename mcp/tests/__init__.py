"""
MCP Server Test Suite

Tests for the Sports Data MCP server including:
- Formatters (ASCII cards, markdown tables, etc.)
- Team reference lookups and fuzzy matching
- API handlers (Odds API, ESPN API)
- MCP tool integration
"""

__all__ = [
    "test_formatters",
    "test_team_reference",
    "conftest",
]
