"""
Live Tennis API Handler
=======================
Handler for the Live Tennis API (https://livetennisapi.com), covering live
scores, fixtures, and player lookups for ATP, WTA, Challenger and ITF.

Vendor disclosure: this provider is authored by the Live Tennis API team, who
proposed it in issue #86. Judge it on the merits — it follows the same handler
pattern as `espn_api_handler.py` and `odds_api_handler.py` and shares the same
`ResponseCache`.

Tier contract (this is the whole point of the docstring — read it):

    Free tier for fixtures, player lookups and low-cadence score checks;
    paid tier for live match-following.

The constraint that makes that split real is the free key's daily quota, not
entitlement. Live scores ARE included on the free tier; the free key is just
30 requests/minute and **100 requests/day**. At the default 30s live cache TTL
a single three-hour match refreshes ~360 times — so following one match to the
end exhausts a free key's whole day inside that one match. A free key sustains
roughly one score check every 15 minutes (~96/day), plus fixtures and player
lookups, plus develop-and-test. Following live state for real is Basic
($9.99/mo, 60/min · 1k/day) or, for a full Slam board, Pro (300/min · 10k/day).

Raising `CACHE_TTL_TENNIS_LIVE` is the free-tier survival knob: a 900s TTL
keeps a whole day of casual score-checking inside the free 100/day allowance.

v1 scope is deliberately the surface a free key can actually exercise: live
scores, fixtures, and player lookups. Rank-ordered rankings (Pro) and H2H
(Basic) are intentionally left out rather than shipped as tools that fail on
the key our own setup docs tell people to get. Match prices are unaffected and
stay with the Odds API's `get_odds` and its `tennis_atp_*` passthrough.

Two things this handler does NOT reuse, on purpose:

* `key_manager.py` — it models a monthly, sticky-until-exhausted quota with no
  per-minute concept, and its marker-string matching would classify a 429
  burst as a drained key and park it for the process. Tennis is 30/min plus
  100/day, so this handler carries its own token-bucket minute limiter and
  tracks the daily quota honestly (from a 429 or from `/usage`), never routing
  through the manager.
* the team formatters in `formatter.py` — tennis output is player-shaped and
  set-by-set, formatted in the tool layer.
"""

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Optional

import aiohttp

from .cache import ResponseCache, make_key

logger = logging.getLogger(__name__)

# Cache lifetimes by endpoint kind, in seconds. Live scores must stay fresh;
# fixtures and player profiles change slowly. `live` defaults to 30s to match
# the ESPN scoreboard, and the composition root lets CACHE_TTL_TENNIS_LIVE
# override it — that override is the free-tier survival knob (see module doc).
DEFAULT_TTLS = {
    "live": 30,       # live match list and single-match score
    "fixtures": 300,  # upcoming schedule
    "player": 3600,   # player profile, ranking, Elo
}

# Free-tier limits, used as defaults for the minute limiter. Basic/Pro raise
# the per-minute rate; the daily allowance is enforced by the API and observed
# here rather than assumed.
FREE_TIER_RPM = 30
FREE_TIER_RPD = 100


def _next_utc_midnight(now: Optional[datetime] = None) -> datetime:
    """The next 00:00 UTC — when a daily quota resets."""
    now = now or datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)


class TokenBucket:
    """A simple per-minute token bucket.

    The free tier is 30 requests/minute. Rather than route a 429 burst through
    the quota-model key manager (which would misclassify it as an exhausted
    key and park it), this gates outgoing requests locally: `acquire()` returns
    False when the minute's budget is spent, and the caller reports a
    rate-limited result without touching the network or the daily quota.

    `time_func` is injectable so the refill is testable without real sleeping.
    """

    def __init__(
        self,
        rate_per_minute: int = FREE_TIER_RPM,
        capacity: Optional[int] = None,
        time_func: Callable[[], float] = time.monotonic,
    ):
        self.rate_per_minute = max(1, rate_per_minute)
        self.rate_per_second = self.rate_per_minute / 60.0
        self.capacity = float(capacity if capacity is not None else self.rate_per_minute)
        self._tokens = self.capacity
        self._time = time_func
        self._last = self._time()

    def _refill(self) -> None:
        now = self._time()
        elapsed = now - self._last
        if elapsed > 0:
            self._tokens = min(self.capacity, self._tokens + elapsed * self.rate_per_second)
            self._last = now

    def acquire(self, tokens: int = 1) -> bool:
        """Take `tokens` from the bucket. Returns False if not enough remain."""
        self._refill()
        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False

    def retry_after(self, tokens: int = 1) -> float:
        """Seconds until `tokens` would be available, for an honest hint."""
        self._refill()
        deficit = tokens - self._tokens
        if deficit <= 0:
            return 0.0
        return round(deficit / self.rate_per_second, 1)


class TennisAPIHandler:
    """Handler for the Live Tennis API (free-tier surface)."""

    BASE_URL = "https://api.livetennisapi.com/api/public/v1"

    def __init__(
        self,
        api_key: str,
        cache: Optional[ResponseCache] = None,
        ttls: Optional[Dict[str, int]] = None,
        rate_per_minute: int = FREE_TIER_RPM,
        rate_limiter: Optional[TokenBucket] = None,
    ):
        """Initialize the Live Tennis API handler.

        Args:
            api_key: A Live Tennis API key (sent as the `X-API-Key` header).
            cache: Optional shared ResponseCache. One is created if omitted.
            ttls: Optional per-kind TTL overrides, merged over DEFAULT_TTLS.
            rate_per_minute: Minute budget for the token bucket (free = 30).
            rate_limiter: Inject a pre-built TokenBucket (used by tests).
        """
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache = cache if cache is not None else ResponseCache()
        self.ttls = {**DEFAULT_TTLS, **(ttls or {})}
        self._bucket = rate_limiter or TokenBucket(rate_per_minute=rate_per_minute)

        # Daily-quota state, learned from a 429 or a `/usage` read. `until` is a
        # UTC datetime while the key is known-exhausted, else None.
        self._daily_exhausted_until: Optional[datetime] = None
        # Last observed usage figures, surfaced by get_quota_status() with no
        # upstream call (mirrors how the Odds handler reports tracked quota).
        self._usage: Dict[str, object] = {}

    # -- quota / rate reporting ------------------------------------------------

    @staticmethod
    def _mask_key(key: str) -> str:
        """Show only the first and last 4 characters of a key."""
        if not key:
            return ""
        if len(key) <= 8:
            return "*" * len(key)
        return f"{key[:4]}...{key[-4:]}"

    def _daily_is_exhausted(self, now: Optional[datetime] = None) -> bool:
        """True while a known daily-quota exhaustion is still in effect."""
        if self._daily_exhausted_until is None:
            return False
        now = now or datetime.now(timezone.utc)
        if now >= self._daily_exhausted_until:
            # The reset time has passed; clear the flag and let requests flow.
            self._daily_exhausted_until = None
            return False
        return True

    def _mark_daily_exhausted(self) -> None:
        """Park the key until the next UTC midnight after a daily-limit hit."""
        self._daily_exhausted_until = _next_utc_midnight()
        logger.warning(
            "Live Tennis API daily quota exhausted; parking until %s UTC",
            self._daily_exhausted_until.isoformat(),
        )

    def get_quota_status(self) -> Dict:
        """Rate-limit and daily-quota health, with the key masked.

        This makes no upstream call: it reports the token bucket's current
        state plus the last observed daily usage, so folding it into
        get_api_status() stays quota-free.
        """
        self._bucket._refill()
        status = {
            "configured": True,
            "key": self._mask_key(self.api_key),
            "per_minute_limit": self._bucket.rate_per_minute,
            "minute_tokens_available": int(self._bucket._tokens),
            "daily_exhausted": self._daily_is_exhausted(),
        }
        if self._daily_exhausted_until is not None:
            status["daily_resets_at"] = self._daily_exhausted_until.isoformat()
        if self._usage:
            status["usage"] = dict(self._usage)
        return status

    def _record_usage(self, usage: Dict) -> None:
        """Fold a `/usage`-shaped block into tracked state.

        Tolerant of key spelling because the field names are the one part of
        the shape a docstring cannot pin down: accepts remaining/limit/reset
        under a few common names, ignores what it does not recognise.
        """
        if not isinstance(usage, dict):
            return

        def pick(*names):
            for n in names:
                if n in usage and usage[n] is not None:
                    return usage[n]
            return None

        remaining = pick("requests_remaining", "remaining", "daily_remaining")
        limit = pick("daily_limit", "limit", "requests_limit")
        reset = pick("resets_at", "reset", "reset_at")
        plan = pick("plan", "tier")

        recorded: Dict[str, object] = {}
        if remaining is not None:
            recorded["daily_remaining"] = remaining
        if limit is not None:
            recorded["daily_limit"] = limit
        if reset is not None:
            recorded["resets_at"] = reset
        if plan is not None:
            recorded["plan"] = plan
        if recorded:
            self._usage = recorded

        # A reported zero remaining is the same signal as a 429: stop spending.
        try:
            if remaining is not None and int(remaining) <= 0:
                self._mark_daily_exhausted()
        except (TypeError, ValueError):
            pass

    # -- HTTP plumbing ---------------------------------------------------------

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create the aiohttp session with the auth header attached."""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(headers={"X-API-Key": self.api_key})
        return self.session

    @staticmethod
    def _is_cacheable(result: Dict) -> bool:
        """Never cache a failure; a blip would become a full TTL of failure."""
        return bool(result.get("success"))

    async def _make_request(self, endpoint: str, params: Dict = None, cache_kind: str = "live") -> Dict:
        """Make a request, serving from cache when possible.

        The API key is deliberately excluded from the cache key: the payload is
        identical whichever key fetched it, and keying on it would throw the
        cache away on rotation. Cache hits carry `"cached": True`.
        """
        params = dict(params or {})
        key = make_key("tennis", endpoint, params)
        ttl = self.ttls.get(cache_kind, 60)

        result, was_hit = await self.cache.get_or_fetch(
            key,
            ttl,
            lambda: self._fetch(endpoint, params),
            should_cache=self._is_cacheable,
        )

        if was_hit:
            result = {**result, "cached": True}

        return result

    async def _fetch(self, endpoint: str, params: Dict) -> Dict:
        """Perform one live request, gated by the daily quota and minute rate.

        Order matters: a known daily exhaustion short-circuits before the
        minute limiter, and both short-circuit before the network, so neither a
        drained day nor a spent minute costs a request or an upstream round
        trip.
        """
        if self._daily_is_exhausted():
            reset = self._daily_exhausted_until
            return {
                "success": False,
                "error": "Daily request quota exhausted for this Live Tennis API key",
                "quota": {
                    "daily_exhausted": True,
                    "resets_at": reset.isoformat() if reset else None,
                    "note": (
                        "Free tier is 100 requests/day. Raise CACHE_TTL_TENNIS_LIVE "
                        "or use a Basic/Pro key to follow live matches."
                    ),
                },
            }

        if not self._bucket.acquire():
            return {
                "success": False,
                "error": "Per-minute rate limit reached for this Live Tennis API key",
                "rate_limited": True,
                "retry_after_seconds": self._bucket.retry_after(),
            }

        url = f"{self.BASE_URL}{endpoint}"
        session = await self._get_session()

        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    # An envelope may carry a usage block (top-level or under
                    # `meta`); fold it into tracked quota if present.
                    if isinstance(data, dict):
                        usage = data.get("usage")
                        if usage is None and isinstance(data.get("meta"), dict):
                            usage = data["meta"].get("usage")
                        if usage:
                            self._record_usage(usage)
                    return {"success": True, "data": data, "cached": False}

                error_text = await response.text()

                if response.status == 429:
                    # A daily-limit 429 parks the key until reset; a per-minute
                    # burst is already handled by the bucket above, so treat a
                    # 429 that slips through as the daily limit.
                    self._mark_daily_exhausted()
                    logger.warning("Live Tennis API 429: %s", error_text)
                    return {
                        "success": False,
                        "error": "Live Tennis API rate/quota limit hit (429)",
                        "details": error_text,
                        "quota": {
                            "daily_exhausted": True,
                            "resets_at": self._daily_exhausted_until.isoformat()
                            if self._daily_exhausted_until
                            else None,
                        },
                    }

                if response.status in (401, 403):
                    logger.error("Live Tennis API auth error %s", response.status)
                    return {
                        "success": False,
                        "error": f"Live Tennis API rejected the key (status {response.status})",
                        "details": error_text,
                    }

                logger.error("Live Tennis API error %s: %s", response.status, error_text)
                return {
                    "success": False,
                    "error": f"API returned status {response.status}",
                    "details": error_text,
                }
        except Exception as e:  # noqa: BLE001 - report, never crash the tool
            logger.error("Request failed: %s", str(e))
            return {"success": False, "error": str(e)}

    # -- endpoints (free-tier surface) ----------------------------------------

    async def get_live_matches(
        self,
        tour: Optional[str] = None,
        status: str = "live",
        limit: int = 20,
    ) -> Dict:
        """List matches and their current score.

        Args:
            tour: Optional tour filter — atp, wta, challenger, or itf.
            status: Match status — live (default), upcoming, or completed.
            limit: Maximum number of matches to return.

        Returns:
            Dictionary with the matches envelope under `data`.
        """
        params: Dict[str, object] = {"status": status, "limit": limit}
        if tour:
            params["tour"] = tour.lower()
        return await self._make_request("/matches", params, cache_kind="live")

    async def get_match_score(self, match_id: str) -> Dict:
        """Read a single match's live score — the lowest-latency score endpoint.

        Args:
            match_id: The match id.

        Returns:
            Dictionary with the score envelope under `data`.
        """
        return await self._make_request(f"/matches/{match_id}/score", cache_kind="live")

    async def get_fixtures(
        self,
        tour: Optional[str] = None,
        date: Optional[str] = None,
        limit: int = 20,
    ) -> Dict:
        """Upcoming matches, so callers know what is about to start.

        Args:
            tour: Optional tour filter — atp, wta, challenger, or itf.
            date: Optional date filter in YYYY-MM-DD.
            limit: Maximum number of fixtures to return.

        Returns:
            Dictionary with the fixtures envelope under `data`.
        """
        params: Dict[str, object] = {"limit": limit}
        if tour:
            params["tour"] = tour.lower()
        if date:
            params["date"] = date
        return await self._make_request("/fixtures", params, cache_kind="fixtures")

    async def get_player(self, player_id: str) -> Dict:
        """A player's profile, including current ranking and Elo rating.

        Args:
            player_id: The player id.

        Returns:
            Dictionary with the player envelope under `data`.
        """
        return await self._make_request(f"/players/{player_id}", cache_kind="player")

    async def get_usage(self) -> Dict:
        """Read the free-tier `/usage` endpoint and fold it into tracked quota.

        `/usage` is itself free and does not spend the daily allowance, so this
        can be called to refresh the numbers get_quota_status() reports.
        """
        result = await self._make_request("/usage", cache_kind="live")
        if result.get("success"):
            data = result.get("data")
            if isinstance(data, dict):
                self._record_usage(data.get("data") if isinstance(data.get("data"), dict) else data)
        return result

    async def close(self):
        """Close the aiohttp session."""
        if self.session and not self.session.closed:
            await self.session.close()


# -- domain helper -----------------------------------------------------------

def derive_break_point(score: Dict) -> Optional[bool]:
    """Derive whether the current point is a break point from a score object.

    Applies the documented rule: it is a break point when the receiver holds
    advantage, or the receiver has 40 while the server has 0/15/30. It never
    holds inside a tiebreak, and is undefined (None) when the server or the
    per-player points are unknown.

    `score` is the Live Tennis API score object: `server` is 1, 2 or null, and
    `points` is a two-element list [player1_point, player2_point] using the
    tennis point labels ("0", "15", "30", "40", "AD").
    """
    if not isinstance(score, dict):
        return None
    if score.get("tiebreak") or score.get("is_tiebreak"):
        return None

    server = score.get("server")
    points = score.get("points")
    if server not in (1, 2) or not isinstance(points, (list, tuple)) or len(points) < 2:
        return None

    server_idx = server - 1
    receiver_idx = 1 - server_idx
    server_pt = str(points[server_idx])
    receiver_pt = str(points[receiver_idx])

    if receiver_pt == "AD":
        return True
    if receiver_pt == "40" and server_pt in ("0", "15", "30"):
        return True
    return False
