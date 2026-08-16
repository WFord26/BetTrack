"""
Team Query Matching
===================
Helpers for turning a natural language team query into (a) a likely sport
key and (b) a reliable match against a team name.

The previous approach was a bare substring test, `query.lower() in
home_team.lower()`, which has two failure modes worth naming:

  * "LA" matches "Los **Ang**eles Lakers"? No — but it does match
    "Dal**la**s Mavericks", "At**la**nta Hawks", and "Phi**la**delphia
    76ers". Any short query silently matches unrelated teams.
  * "Sox" matches both Boston and Chicago, with no way to tell them apart.

Matching here is word aware: a query matches when every token in it appears
as a word (or word prefix) in the team name, or when it is that team's
abbreviation. Short queries must match a whole word rather than a fragment.
"""

import re
from typing import Dict, Optional, Set

from .team_reference import NFL_TEAMS, NBA_TEAMS, NHL_TEAMS

# The sports searched when a query cannot be attributed to one league.
DEFAULT_SEARCH_SPORTS = (
    "americanfootball_nfl",
    "basketball_nba",
    "baseball_mlb",
    "icehockey_nhl",
)

# MLB is not in team_reference.py, so nicknames are listed here to give the
# sport guesser reasonable coverage of the fourth major league.
_MLB_NICKNAMES = {
    "diamondbacks", "braves", "orioles", "red sox", "cubs", "white sox",
    "reds", "guardians", "rockies", "tigers", "astros", "royals", "angels",
    "dodgers", "marlins", "brewers", "twins", "mets", "yankees", "athletics",
    "phillies", "pirates", "padres", "giants", "mariners", "cardinals",
    "rays", "rangers", "blue jays", "nationals",
}

_LEAGUE_KEYWORDS = {
    "americanfootball_nfl": {"nfl", "football"},
    "basketball_nba": {"nba", "basketball"},
    "baseball_mlb": {"mlb", "baseball"},
    "icehockey_nhl": {"nhl", "hockey"},
}


def _tokenize(text: str) -> list:
    """Lowercase word tokens, dropping punctuation."""
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _nicknames_and_abbrs(table: Dict) -> tuple:
    """Extract the last word of each team name plus its abbreviation."""
    nicknames: Set[str] = set()
    abbrs: Set[str] = set()
    for full_name, meta in table.items():
        tokens = _tokenize(full_name)
        if tokens:
            nicknames.add(tokens[-1])
        abbr = (meta or {}).get("abbr")
        if abbr:
            abbrs.add(abbr.lower())
    return nicknames, abbrs


_NFL_NICKS, _NFL_ABBRS = _nicknames_and_abbrs(NFL_TEAMS)
_NBA_NICKS, _NBA_ABBRS = _nicknames_and_abbrs(NBA_TEAMS)
_NHL_NICKS, _NHL_ABBRS = _nicknames_and_abbrs(NHL_TEAMS)
_MLB_NICKS = {tok for name in _MLB_NICKNAMES for tok in _tokenize(name)}

_SPORT_NICKNAMES = {
    "americanfootball_nfl": _NFL_NICKS,
    "basketball_nba": _NBA_NICKS,
    "icehockey_nhl": _NHL_NICKS,
    "baseball_mlb": _MLB_NICKS,
}

_SPORT_ABBRS = {
    "americanfootball_nfl": _NFL_ABBRS,
    "basketball_nba": _NBA_ABBRS,
    "icehockey_nhl": _NHL_ABBRS,
}


def guess_sport_key(query: str) -> Optional[str]:
    """Infer an Odds API sport key from a team query.

    Returns None when the query is ambiguous across leagues (for example
    "Rangers", which is both an NHL and an MLB team) or simply unrecognised,
    so the caller can decide whether to fan out.
    """
    tokens = _tokenize(query)
    if not tokens:
        return None

    token_set = set(tokens)

    # An explicit league word beats any nickname inference.
    for sport, keywords in _LEAGUE_KEYWORDS.items():
        if token_set & keywords:
            return sport

    matches = {
        sport for sport, nicks in _SPORT_NICKNAMES.items()
        if token_set & nicks
    }

    # Abbreviations only count for a single-token query ("KC", "LAL");
    # inside a longer phrase they produce noise.
    if not matches and len(tokens) == 1:
        matches = {
            sport for sport, abbrs in _SPORT_ABBRS.items()
            if tokens[0] in abbrs
        }

    # Exactly one league claims it, or we cannot say.
    return matches.pop() if len(matches) == 1 else None


def team_matches(query: str, team_name: str) -> bool:
    """True when `query` plausibly names `team_name`.

    Every query token must appear as a word or word prefix in the team name,
    so "Red Sox" matches "Boston Red Sox" while "LA" no longer matches
    "Dallas Mavericks". A two or three character query is also accepted when
    it equals the team's abbreviation.
    """
    query_tokens = _tokenize(query)
    name_tokens = _tokenize(team_name)

    if not query_tokens or not name_tokens:
        return False

    for q in query_tokens:
        if len(q) <= 3:
            # Short tokens must match a full word; a prefix test would let
            # "LA" match "Lakers" and "SF" match nothing useful.
            if q not in name_tokens and not _matches_abbreviation(q, team_name):
                return False
        else:
            if not any(n.startswith(q) or q.startswith(n) for n in name_tokens):
                return False

    return True


def _matches_abbreviation(token: str, team_name: str) -> bool:
    """True when `token` is the known abbreviation for `team_name`."""
    token = token.lower()
    for table in (NFL_TEAMS, NBA_TEAMS, NHL_TEAMS):
        meta = table.get(team_name)
        if meta and (meta.get("abbr") or "").lower() == token:
            return True
    return False
