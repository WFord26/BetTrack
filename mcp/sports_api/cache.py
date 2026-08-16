"""
Async Response Cache
====================
A small TTL cache for upstream API responses, built for two goals:

1. Cut Odds API quota burn. The free tier allows 500 requests a month, and
   every repeated question in a conversation ("what are the Lakers odds"
   asked twice) previously cost a fresh request.
2. Coalesce concurrent identical requests. Several tools fan out to the same
   ESPN scoreboard; without coalescing, N parallel calls become N upstream
   requests for one piece of data.

Design notes:

* Only successful responses are cached. An error dict cached for 60 seconds
  would turn a blip into a minute of failure.
* Entries are bounded and evicted oldest-first, so a long session cannot grow
  the cache without limit.
* Coalescing is per key. The first caller performs the fetch; everyone else
  awaits the same future and shares the result, paying nothing upstream.
"""

import asyncio
import json
import logging
import time
from collections import OrderedDict
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_MAX_ENTRIES = 256


def make_key(*parts: Any) -> str:
    """Build a stable cache key from arbitrary parts.

    Dicts are serialised with sorted keys so that two calls with the same
    params in a different order share one entry. Never include an API key in
    the parts — the cached payload is identical regardless of which key
    fetched it, and keying on it would defeat the cache after a rotation.
    """
    chunks = []
    for part in parts:
        if isinstance(part, dict):
            chunks.append(json.dumps(part, sort_keys=True, default=str))
        else:
            chunks.append(str(part))
    return "|".join(chunks)


class ResponseCache:
    """TTL cache with request coalescing and hit/miss accounting."""

    def __init__(self, max_entries: int = DEFAULT_MAX_ENTRIES, enabled: bool = True):
        self.enabled = enabled
        self.max_entries = max(1, max_entries)

        # key -> (expires_at, value). OrderedDict gives us cheap oldest-first
        # eviction without pulling in a dependency.
        self._entries: "OrderedDict[str, Tuple[float, Any]]" = OrderedDict()

        # key -> in-flight future, so concurrent callers share one fetch.
        self._inflight: Dict[str, asyncio.Future] = {}

        self.hits = 0
        self.misses = 0
        self.coalesced = 0
        self.evictions = 0
        self.expirations = 0

    # -- internals ---------------------------------------------------------

    def _purge_expired(self, now: float) -> None:
        expired = [k for k, (exp, _) in self._entries.items() if exp <= now]
        for key in expired:
            del self._entries[key]
            self.expirations += 1

    def _evict_if_needed(self) -> None:
        while len(self._entries) > self.max_entries:
            self._entries.popitem(last=False)
            self.evictions += 1

    def _lookup(self, key: str) -> Tuple[bool, Any]:
        """Return (found, value), treating an expired entry as absent."""
        entry = self._entries.get(key)
        if entry is None:
            return False, None

        expires_at, value = entry
        if expires_at <= time.monotonic():
            del self._entries[key]
            self.expirations += 1
            return False, None

        # Refresh recency so hot keys survive eviction.
        self._entries.move_to_end(key)
        return True, value

    # -- public API --------------------------------------------------------

    def get(self, key: str) -> Tuple[bool, Any]:
        """Look up a key without fetching. Returns (found, value)."""
        if not self.enabled:
            return False, None
        return self._lookup(key)

    def set(self, key: str, value: Any, ttl: float) -> None:
        """Store a value for `ttl` seconds. A ttl <= 0 stores nothing."""
        if not self.enabled or ttl <= 0:
            return

        self._entries[key] = (time.monotonic() + ttl, value)
        self._entries.move_to_end(key)
        self._evict_if_needed()

    async def get_or_fetch(
        self,
        key: str,
        ttl: float,
        fetch: Callable[[], Awaitable[Any]],
        should_cache: Optional[Callable[[Any], bool]] = None,
    ) -> Tuple[Any, bool]:
        """Return a cached value, or call `fetch` and cache what it returns.

        Args:
            key: Cache key, from `make_key`
            ttl: Seconds to keep the result. A ttl <= 0 bypasses storage but
                 still coalesces concurrent callers.
            fetch: Zero argument coroutine performing the upstream request
            should_cache: Optional predicate; the result is only stored when
                 it returns True. Defaults to caching everything, so callers
                 that can fail must pass a predicate.

        Returns:
            (value, was_cache_hit)
        """
        if not self.enabled:
            return await fetch(), False

        found, value = self._lookup(key)
        if found:
            self.hits += 1
            return value, True

        # Someone else is already fetching this exact key — wait for them
        # instead of issuing a second upstream request.
        inflight = self._inflight.get(key)
        if inflight is not None:
            self.coalesced += 1
            return await asyncio.shield(inflight), False

        self.misses += 1
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._inflight[key] = future

        try:
            result = await fetch()
        except BaseException as exc:
            # Wake the waiters with the same failure rather than leaving them
            # hanging on a future that never resolves.
            if not future.done():
                future.set_exception(exc)
            self._inflight.pop(key, None)
            # A future whose exception is never retrieved logs a warning at
            # GC time; this consumes it if nobody was waiting.
            future.exception()
            raise
        else:
            if should_cache is None or should_cache(result):
                self.set(key, result, ttl)
            if not future.done():
                future.set_result(result)
            self._inflight.pop(key, None)
            return result, False

    def invalidate(self, prefix: Optional[str] = None) -> int:
        """Drop cached entries. With a prefix, only matching keys.

        Returns the number of entries removed.
        """
        if prefix is None:
            removed = len(self._entries)
            self._entries.clear()
            return removed

        keys = [k for k in self._entries if k.startswith(prefix)]
        for key in keys:
            del self._entries[key]
        return len(keys)

    def stats(self) -> Dict[str, Any]:
        """Cache counters, including an estimate of upstream calls avoided."""
        self._purge_expired(time.monotonic())

        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total else 0.0

        return {
            "enabled": self.enabled,
            "entries": len(self._entries),
            "max_entries": self.max_entries,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 1),
            "coalesced_requests": self.coalesced,
            "evictions": self.evictions,
            "expirations": self.expirations,
            "upstream_requests_avoided": self.hits + self.coalesced,
        }
