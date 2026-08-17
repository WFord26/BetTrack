"""
Tests for sports_api/key_manager.py

Covers key rotation, exhaustion/invalid classification, and status reporting
for the sticky Odds API key manager.
"""

import pytest

from sports_api.key_manager import APIKeyManager


class TestInit:
    def test_requires_at_least_one_key(self):
        with pytest.raises(ValueError):
            APIKeyManager([])

    def test_drops_blank_keys(self):
        manager = APIKeyManager(["", "  ", "key1"])
        assert len(manager.states) == 1

    def test_dedupes_keys_preserving_order(self):
        manager = APIKeyManager(["key1", "key2", "key1"])
        assert [s.key for s in manager.states] == ["key1", "key2"]


class TestGetKey:
    def test_single_key_returned(self):
        manager = APIKeyManager(["key1"])
        assert manager.get_key() == "key1"

    def test_sticks_to_active_key_while_healthy(self):
        manager = APIKeyManager(["key1", "key2"])
        assert manager.get_key() == "key1"
        assert manager.get_key() == "key1"

    def test_rotates_after_exhaustion(self):
        manager = APIKeyManager(["key1", "key2"])
        manager.report_failure("key1", 429)
        assert manager.get_key() == "key2"
        assert manager.rotations == 1

    def test_all_exhausted_returns_none(self):
        manager = APIKeyManager(["key1", "key2"])
        manager.report_failure("key1", 429)
        manager.report_failure("key2", 429)
        assert manager.get_key() is None


class TestReportSuccess:
    def test_tracks_remaining_and_used(self):
        manager = APIKeyManager(["key1"])
        manager.report_success("key1", remaining="10", used="490")
        assert manager.active.remaining == 10
        assert manager.active.used == 490
        assert manager.active.requests_made == 1

    def test_zero_remaining_marks_exhausted(self):
        manager = APIKeyManager(["key1"])
        manager.report_success("key1", remaining="0")
        assert manager.active.status == "exhausted"

    def test_unknown_key_is_noop(self):
        manager = APIKeyManager(["key1"])
        manager.report_success("not-a-real-key", remaining="10")
        assert manager.active.requests_made == 0


class TestReportFailure:
    def test_429_marks_exhausted(self):
        manager = APIKeyManager(["key1"])
        status = manager.report_failure("key1", 429)
        assert status == "exhausted"
        assert manager.active.status == "exhausted"

    def test_401_with_quota_marker_marks_exhausted(self):
        manager = APIKeyManager(["key1"])
        status = manager.report_failure("key1", 401, body="Usage quota exceeded")
        assert status == "exhausted"

    def test_401_without_quota_marker_marks_invalid(self):
        manager = APIKeyManager(["key1"])
        status = manager.report_failure("key1", 401, body="Invalid API key")
        assert status == "invalid"

    def test_5xx_leaves_key_healthy(self):
        manager = APIKeyManager(["key1"])
        status = manager.report_failure("key1", 503, body="server error")
        assert status == "healthy"
        assert manager.active.is_usable


class TestStatusAndMasking:
    def test_masked_key_hides_middle(self):
        manager = APIKeyManager(["abcdefghij"])
        masked = manager.active.masked()
        assert masked == "abcd...ghij"
        assert "efghi" not in masked

    def test_short_key_fully_masked(self):
        manager = APIKeyManager(["abc"])
        assert manager.active.masked() == "****"

    def test_has_usable_key(self):
        manager = APIKeyManager(["key1", "key2"])
        assert manager.has_usable_key()
        manager.report_failure("key1", 429)
        manager.report_failure("key2", 401, body="invalid key")
        assert not manager.has_usable_key()

    def test_status_summary_shape(self):
        manager = APIKeyManager(["key1", "key2"])
        manager.report_success("key1", remaining="100")
        status = manager.status()

        assert status["total_keys"] == 2
        assert status["usable_keys"] == 2
        assert status["requests_remaining_across_keys"] == 100
        assert len(status["keys"]) == 2
