"""
BetTrack Dashboard API package
==============================
Shared client and MCP tool definitions for the self-hosted BetTrack dashboard.

Used by both entry points:
  * `sports_mcp_server.py`    — registers these tools alongside the sports
                                data tools when DASHBOARD_API_KEY is set
  * `dashboard_mcp_server.py` — standalone dashboard-only server
"""

from .client import configure, is_configured, get_api_url
from .tools import register_dashboard_tools

__all__ = [
    "configure",
    "is_configured",
    "get_api_url",
    "register_dashboard_tools",
]
