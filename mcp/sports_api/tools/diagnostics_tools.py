"""
Diagnostics MCP Tools
=====================
Introspection tools for API quota, key health, and cache stats. Neither
tool makes an upstream call, so both cost no quota.

`register_diagnostics_tools(mcp, response_cache, odds_handler, dashboard_tool_names)`
attaches every tool in this module to the given FastMCP instance.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)


def register_diagnostics_tools(
    mcp,
    response_cache,
    odds_handler,
    dashboard_tool_names: List[str],
) -> None:
    """Attach the diagnostics tools to `mcp`.

    Args:
        mcp: A FastMCP server instance
        response_cache: The shared ResponseCache instance
        odds_handler: An OddsAPIHandler instance, or None if ODDS_API_KEY is
            not configured
        dashboard_tool_names: Names of the dashboard tools registered
            (empty when DASHBOARD_API_KEY is not configured)
    """

    @mcp.tool()
    def get_api_status() -> dict:
        """
        Report Odds API quota, key health, and response cache statistics.

        Use this when the user asks how many API requests they have left, why a
        request failed, whether their keys are working, or how much the cache is
        saving them. It makes no upstream API calls, so it costs no quota.

        Returns:
            Dictionary with:
              odds_api: per key status with quota remaining. Keys are masked to
                  their first and last 4 characters. Status is one of:
                  healthy    — usable
                  exhausted  — out of credits; the Odds API quota resets monthly
                  invalid    — rejected as a bad key; retired for this session
              cache: hit rate, entry count, and upstream requests avoided
              dashboard: whether the BetTrack dashboard tools are registered

        Example:
            get_api_status() -> {"odds_api": {...}, "cache": {...}}
        """
        status = {
            "cache": response_cache.stats(),
            "dashboard": {
                "configured": len(dashboard_tool_names) > 0,
                "tools_registered": len(dashboard_tool_names),
            },
        }

        if odds_handler:
            status["odds_api"] = odds_handler.get_key_status()
        else:
            status["odds_api"] = {
                "configured": False,
                "note": "ODDS_API_KEY is not set. ESPN tools work without it.",
            }

        status["espn_api"] = {"configured": True, "requires_key": False}
        return status

    @mcp.tool()
    def clear_cache() -> dict:
        """
        Drop all cached API responses, forcing the next call to hit the API live.

        Use this only when the user explicitly wants fresh data and suspects a
        cached response is stale — for example right after a line moves. Normal
        use does not need it, since entries expire on their own within 30 to 60
        seconds. Clearing costs quota on the next call.

        Returns:
            Dictionary with the number of entries removed

        Example:
            clear_cache() -> {"success": True, "entries_cleared": 12}
        """
        removed = response_cache.invalidate()
        logger.info(f"Cache cleared on request ({removed} entries)")

        return {
            "success": True,
            "entries_cleared": removed,
            "note": "The next call for each query will fetch live data.",
        }
