"""
BetTrack Dashboard API Client
=============================
HTTP client for the self-hosted BetTrack dashboard's API key authenticated
routes (`/api/mcp/*`).

Configuration is read lazily via `configure()` rather than at import time, so
the caller can load a `.env` file first. Nothing here exits the process: if the
dashboard is not configured, `is_configured()` returns False and the caller
decides whether to register the dashboard tools at all.
"""

import asyncio
import atexit
import logging
import os
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)

DEFAULT_API_URL = "http://localhost:3001"

_api_key: Optional[str] = None
_api_url: str = DEFAULT_API_URL
_session: Optional[aiohttp.ClientSession] = None


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def configure(api_key: Optional[str] = None, api_url: Optional[str] = None) -> bool:
    """Read dashboard configuration from the environment (or explicit args).

    Call this *after* loading any `.env` file. Returns True when an API key is
    present, meaning the dashboard tools are usable.

    Args:
        api_key: Overrides DASHBOARD_API_KEY when provided
        api_url: Overrides DASHBOARD_API_URL when provided
    """
    global _api_key, _api_url

    _api_key = (api_key or os.getenv("DASHBOARD_API_KEY") or "").strip() or None
    _api_url = (api_url or os.getenv("DASHBOARD_API_URL") or DEFAULT_API_URL).strip()

    # Trailing slashes would produce '//api/...' once we append the path.
    _api_url = _api_url.rstrip("/")

    if _api_key:
        _warn_if_insecure(_api_url)

    return _api_key is not None


def _warn_if_insecure(url: str) -> None:
    """Warn when an API key would be sent over plaintext to a remote host.

    Plain HTTP is fine against a loopback address on the user's own machine.
    Anywhere else it leaks the bearer token and the user's bet history to
    anything on the network path.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        logger.warning("DASHBOARD_API_URL is not a parseable URL: %s", url)
        return

    if parsed.scheme == "https":
        return

    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return

    logger.warning(
        "SECURITY: DASHBOARD_API_URL uses %s:// for remote host '%s'. "
        "Your API key and bet data will be sent unencrypted. "
        "Use https:// for any hosted deployment.",
        parsed.scheme or "(none)",
        host or "(unknown)",
    )


def is_configured() -> bool:
    """True when a dashboard API key is available."""
    return _api_key is not None


def get_api_url() -> str:
    """The configured dashboard base URL, without a trailing slash."""
    return _api_url


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

async def get_session() -> aiohttp.ClientSession:
    """Return the shared aiohttp session, creating it on first call."""
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


def _close_session() -> None:
    """Synchronously schedule session closure on interpreter shutdown."""
    global _session
    if _session and not _session.closed:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_session.close())
            else:
                loop.run_until_complete(_session.close())
        except Exception:
            pass


atexit.register(_close_session)


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

def clean_params(**kwargs: Any) -> Dict[str, Any]:
    """Build a query param dict, dropping any None values.

    aiohttp serialises None as the literal string "None", which the backend
    would then try to parse. Filtering here keeps every tool from repeating
    the same guard.
    """
    return {k: v for k, v in kwargs.items() if v is not None}


async def make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Make an authenticated request to the dashboard API.

    Returns a structured error dict for HTTP 4xx/5xx responses so the LLM
    receives a clear failure signal instead of a raw error body.
    """
    if not _api_key:
        return {
            "error": "Dashboard not configured",
            "detail": (
                "DASHBOARD_API_KEY is not set. Add it to your .env file to "
                "enable dashboard tools, then restart Claude Desktop."
            )
        }

    headers = {
        "Authorization": f"Bearer {_api_key}",
        "Content-Type": "application/json"
    }

    url = f"{_api_url}/api{endpoint}"
    session = await get_session()

    try:
        if method == "GET":
            response = await session.get(url, headers=headers, params=params)
        elif method == "POST":
            response = await session.post(url, headers=headers, json=data)
        elif method == "DELETE":
            response = await session.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
    except aiohttp.ClientError as exc:
        # A dashboard that is down or unreachable should surface as a readable
        # tool result, not an exception that aborts the whole tool call.
        logger.error("Dashboard request failed (%s %s): %s", method, endpoint, exc)
        return {
            "error": "Dashboard unreachable",
            "detail": f"{type(exc).__name__}: {exc}",
            "url": url
        }

    if response.status >= 400:
        detail = await response.text()
        return {
            "error": f"HTTP {response.status}",
            "status": response.status,
            "detail": detail
        }

    return await response.json()
