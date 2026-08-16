#!/usr/bin/env python3
"""
Sports Dashboard MCP Server (standalone)
========================================
Runs ONLY the BetTrack dashboard tools, with no sports data tools attached.

Most users do not need this. The packaged `.mcpb` installs
`sports_mcp_server.py`, which registers these same dashboard tools
automatically whenever DASHBOARD_API_KEY is set. This entry point exists for
running the dashboard surface on its own — for example as a second MCP server
pointed at a different dashboard instance, or when debugging dashboard tools
in isolation.

Configuration (environment or a `.env` file beside this script):
    DASHBOARD_API_KEY   Required. An API key from the dashboard's
                        Settings -> API Keys, prefixed `sk_`.
    DASHBOARD_API_URL   Optional. Defaults to http://localhost:3001.
                        MUST be https:// for any hosted deployment.
"""

import logging
import os
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from dashboard_api import client
from dashboard_api.tools import register_dashboard_tools

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load a .env sitting next to this script, if python-dotenv is available.
# The combined server loads from its persistent config directory instead;
# here we keep it simple since this path is for local and debug use.
try:
    from dotenv import load_dotenv

    env_path = Path(__file__).parent.absolute() / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded .env from %s", env_path)
    else:
        load_dotenv()
except ImportError:
    logger.debug("python-dotenv not installed; reading environment directly")

mcp = FastMCP("Sports Dashboard")

if not client.configure():
    print(
        "ERROR: DASHBOARD_API_KEY environment variable not set.\n"
        "Set it in your environment or in a .env file next to this script.\n"
        "Generate a key from the dashboard under Settings -> API Keys.",
        file=sys.stderr
    )
    sys.exit(1)

_tool_names = register_dashboard_tools(mcp)


if __name__ == "__main__":
    logger.info("Starting Sports Dashboard MCP Server...")
    logger.info("Dashboard URL: %s", client.get_api_url())
    logger.info("Registered %d dashboard tools", len(_tool_names))
    mcp.run()
