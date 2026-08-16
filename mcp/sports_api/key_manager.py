"""
Odds API Key Manager
====================
Failure aware rotation across one or more Odds API keys.

The previous behaviour rotated round robin on *every* request, which meant a
dead or exhausted key was retried every Nth call for the rest of the session,
and quota was spread evenly across keys so they all ran dry at once.

This manager is sticky instead: it uses one key until that key is actually
unusable, then moves to the next. A key becomes unusable when it is

  * exhausted  — the API reports zero requests remaining, or returns a usage
                 or quota error. Recoverable: the Odds API quota resets
                 monthly, so the key is parked rather than discarded.
  * invalid    — the API rejects it as a bad key. Not recoverable within this
                 process, so it is retired for the session.

Draining one key at a time is what you want on a metered API: it keeps the
remaining keys at full quota as reserve, and it makes the reported
"requests remaining" figure meaningful rather than an average across keys.
"""

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Substrings the Odds API uses when a key is out of credits rather than bad.
# Checked case-insensitively against the error body.
_QUOTA_MARKERS = (
    "usage",
    "quota",
    "credit",
    "exceeded",
    "limit",
)


class KeyState:
    """Health and quota accounting for a single API key."""

    def __init__(self, key: str, index: int):
        self.key = key
        self.index = index
        self.requests_made = 0
        self.remaining: Optional[int] = None   # None until the API tells us
        self.used: Optional[int] = None
        self.status = "healthy"                # healthy | exhausted | invalid
        self.last_error: Optional[str] = None
        self.disabled_at: Optional[float] = None

    @property
    def is_usable(self) -> bool:
        return self.status == "healthy"

    def masked(self) -> str:
        """A key fragment safe to put in logs and tool output."""
        if len(self.key) <= 8:
            return "****"
        return f"{self.key[:4]}...{self.key[-4:]}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.masked(),
            "position": self.index + 1,
            "status": self.status,
            "requests_made_this_session": self.requests_made,
            "requests_remaining": self.remaining,
            "requests_used": self.used,
            "last_error": self.last_error,
        }


class APIKeyManager:
    """Hands out Odds API keys, sticking to one until it stops working."""

    def __init__(self, keys: List[str]):
        cleaned = [k.strip() for k in keys if k and k.strip()]
        if not cleaned:
            raise ValueError("APIKeyManager requires at least one API key")

        # Preserve order but drop duplicates — the same key twice would
        # double-count quota and give a false sense of headroom.
        seen = set()
        unique = []
        for key in cleaned:
            if key not in seen:
                seen.add(key)
                unique.append(key)

        if len(unique) != len(cleaned):
            logger.warning(
                "Ignored %d duplicate Odds API key(s)", len(cleaned) - len(unique)
            )

        self.states = [KeyState(k, i) for i, k in enumerate(unique)]
        self._active_index = 0
        self.rotations = 0

        if len(self.states) > 1:
            logger.info(
                "Odds API key rotation enabled with %d keys "
                "(sticky: one key is drained before moving to the next)",
                len(self.states),
            )

    # -- selection ---------------------------------------------------------

    def _advance(self) -> bool:
        """Move to the next usable key. False when none remain."""
        for offset in range(1, len(self.states) + 1):
            candidate = (self._active_index + offset) % len(self.states)
            if self.states[candidate].is_usable:
                previous = self._active_index
                self._active_index = candidate
                self.rotations += 1
                logger.info(
                    "Rotated Odds API key %s -> %s (%s)",
                    self.states[previous].masked(),
                    self.states[candidate].masked(),
                    self.states[previous].status,
                )
                return True
        return False

    def get_key(self) -> Optional[str]:
        """The current key, rotating first if it has become unusable.

        Returns None when every key is exhausted or invalid.
        """
        current = self.states[self._active_index]
        if current.is_usable:
            return current.key

        if self._advance():
            return self.states[self._active_index].key

        return None

    @property
    def active(self) -> KeyState:
        return self.states[self._active_index]

    def _state_for(self, key: str) -> Optional[KeyState]:
        for state in self.states:
            if state.key == key:
                return state
        return None

    # -- feedback ----------------------------------------------------------

    def report_success(
        self,
        key: str,
        remaining: Optional[str] = None,
        used: Optional[str] = None,
    ) -> None:
        """Record a successful call and the quota headers it returned."""
        state = self._state_for(key)
        if state is None:
            return

        state.requests_made += 1

        if remaining is not None:
            try:
                state.remaining = int(remaining)
            except (TypeError, ValueError):
                pass

        if used is not None:
            try:
                state.used = int(used)
            except (TypeError, ValueError):
                pass

        # Park the key the moment quota runs out, so the next call rotates
        # instead of spending a request to discover the same thing.
        if state.remaining is not None and state.remaining <= 0:
            state.status = "exhausted"
            state.disabled_at = time.time()
            state.last_error = "Quota reached (0 requests remaining)"
            logger.warning(
                "Odds API key %s is out of quota; rotating on next request",
                state.masked(),
            )

    def report_failure(self, key: str, status_code: int, body: str = "") -> str:
        """Record a failed call and classify the key.

        Returns the resulting key status: "healthy", "exhausted", or "invalid".
        A transient failure (5xx, network) leaves the key healthy.
        """
        state = self._state_for(key)
        if state is None:
            return "healthy"

        state.requests_made += 1
        body_lower = (body or "").lower()

        if status_code == 429:
            state.status = "exhausted"
            state.last_error = "Rate limited or out of credits (HTTP 429)"
        elif status_code in (401, 403):
            # The Odds API returns 401 both for a bad key and for a key that
            # has burned through its credits, so the body decides.
            if any(marker in body_lower for marker in _QUOTA_MARKERS):
                state.status = "exhausted"
                state.last_error = f"Out of credits (HTTP {status_code})"
            else:
                state.status = "invalid"
                state.last_error = f"Rejected as invalid (HTTP {status_code})"
        else:
            # 5xx and anything else is the API's problem, not the key's.
            state.last_error = f"HTTP {status_code}"
            return "healthy"

        state.disabled_at = time.time()
        logger.warning(
            "Odds API key %s marked %s: %s",
            state.masked(),
            state.status,
            state.last_error,
        )
        return state.status

    def has_usable_key(self) -> bool:
        return any(state.is_usable for state in self.states)

    # -- reporting ---------------------------------------------------------

    def status(self) -> Dict[str, Any]:
        """A summary safe to return from a tool (keys are masked)."""
        usable = [s for s in self.states if s.is_usable]
        known = [s.remaining for s in self.states if s.remaining is not None]

        return {
            "total_keys": len(self.states),
            "usable_keys": len(usable),
            "active_key": self.active.masked(),
            "rotations_this_session": self.rotations,
            "total_requests_this_session": sum(s.requests_made for s in self.states),
            "requests_remaining_across_keys": sum(known) if known else None,
            "keys": [s.to_dict() for s in self.states],
        }
