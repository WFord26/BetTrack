"""
Tests for sports_api/cache.py

Covers TTL expiry, eviction, request coalescing, and the `should_cache`
predicate on ResponseCache.get_or_fetch.
"""

import asyncio

import pytest

from sports_api.cache import ResponseCache, make_key


class TestMakeKey:
    def test_stable_dict_ordering(self):
        key_a = make_key("odds", {"b": 1, "a": 2})
        key_b = make_key("odds", {"a": 2, "b": 1})
        assert key_a == key_b

    def test_different_parts_differ(self):
        assert make_key("odds", "nba") != make_key("odds", "nfl")


class TestGetSet:
    def test_set_then_get_hit(self):
        cache = ResponseCache()
        cache.set("k", {"value": 1}, ttl=60)
        found, value = cache.get("k")
        assert found is True
        assert value == {"value": 1}

    def test_get_miss(self):
        cache = ResponseCache()
        found, value = cache.get("missing")
        assert found is False
        assert value is None

    def test_zero_ttl_not_stored(self):
        cache = ResponseCache()
        cache.set("k", "v", ttl=0)
        found, _ = cache.get("k")
        assert found is False

    def test_disabled_cache_never_hits(self):
        cache = ResponseCache(enabled=False)
        cache.set("k", "v", ttl=60)
        found, _ = cache.get("k")
        assert found is False

    def test_expired_entry_treated_as_miss(self):
        cache = ResponseCache()
        cache.set("k", "v", ttl=-1)  # already expired
        found, _ = cache.get("k")
        assert found is False

    def test_eviction_oldest_first(self):
        cache = ResponseCache(max_entries=2)
        cache.set("a", 1, ttl=60)
        cache.set("b", 2, ttl=60)
        cache.set("c", 2, ttl=60)  # should evict "a"

        found_a, _ = cache.get("a")
        found_c, _ = cache.get("c")
        assert found_a is False
        assert found_c is True
        assert cache.evictions == 1


class TestGetOrFetch:
    @pytest.mark.asyncio
    async def test_fetch_on_miss(self):
        cache = ResponseCache()
        calls = []

        async def fetch():
            calls.append(1)
            return {"success": True, "data": "x"}

        value, was_hit = await cache.get_or_fetch("k", 60, fetch)
        assert value == {"success": True, "data": "x"}
        assert was_hit is False
        assert len(calls) == 1

    @pytest.mark.asyncio
    async def test_second_call_is_cache_hit(self):
        cache = ResponseCache()
        calls = []

        async def fetch():
            calls.append(1)
            return {"success": True}

        await cache.get_or_fetch("k", 60, fetch)
        value, was_hit = await cache.get_or_fetch("k", 60, fetch)

        assert was_hit is True
        assert len(calls) == 1, "Second call should not re-fetch"

    @pytest.mark.asyncio
    async def test_should_cache_false_skips_storage(self):
        cache = ResponseCache()

        async def fetch():
            return {"success": False}

        await cache.get_or_fetch("k", 60, fetch, should_cache=lambda r: r.get("success"))
        found, _ = cache.get("k")
        assert found is False

    @pytest.mark.asyncio
    async def test_concurrent_calls_coalesce(self):
        cache = ResponseCache()
        calls = []

        async def fetch():
            calls.append(1)
            await asyncio.sleep(0.01)
            return {"success": True}

        results = await asyncio.gather(
            cache.get_or_fetch("k", 60, fetch),
            cache.get_or_fetch("k", 60, fetch),
            cache.get_or_fetch("k", 60, fetch),
        )

        assert len(calls) == 1, "Only the first caller should fetch"
        assert cache.coalesced == 2
        assert all(r[0] == {"success": True} for r in results)

    @pytest.mark.asyncio
    async def test_exception_propagates_to_waiters(self):
        cache = ResponseCache()

        async def failing_fetch():
            await asyncio.sleep(0.01)
            raise RuntimeError("upstream down")

        async def call():
            return await cache.get_or_fetch("k", 60, failing_fetch)

        results = await asyncio.gather(call(), call(), return_exceptions=True)
        assert all(isinstance(r, RuntimeError) for r in results)

    @pytest.mark.asyncio
    async def test_disabled_cache_always_fetches(self):
        cache = ResponseCache(enabled=False)
        calls = []

        async def fetch():
            calls.append(1)
            return {"success": True}

        await cache.get_or_fetch("k", 60, fetch)
        await cache.get_or_fetch("k", 60, fetch)
        assert len(calls) == 2


class TestInvalidateAndStats:
    def test_invalidate_all(self):
        cache = ResponseCache()
        cache.set("a", 1, 60)
        cache.set("b", 2, 60)
        removed = cache.invalidate()
        assert removed == 2
        assert cache.get("a") == (False, None)

    def test_invalidate_prefix(self):
        cache = ResponseCache()
        cache.set("odds|nba", 1, 60)
        cache.set("odds|nfl", 2, 60)
        cache.set("espn|scoreboard", 3, 60)

        removed = cache.invalidate(prefix="odds|")
        assert removed == 2
        assert cache.get("espn|scoreboard")[0] is True

    @pytest.mark.asyncio
    async def test_stats_hit_rate(self):
        # hits/misses are only tallied by get_or_fetch, not the bare get()/set().
        cache = ResponseCache()

        async def fetch():
            return {"success": True}

        await cache.get_or_fetch("k", 60, fetch)  # miss, then stored
        await cache.get_or_fetch("k", 60, fetch)  # hit

        stats = cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["entries"] == 1
        assert stats["hit_rate_percent"] == 50.0
