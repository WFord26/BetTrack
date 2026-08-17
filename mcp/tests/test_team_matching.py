"""
Tests for sports_api/team_matching.py

Pure functions: sport-key inference from a natural language query, and
word-aware team name matching.
"""

import pytest
from sports_api.team_matching import guess_sport_key, team_matches


class TestGuessSportKey:
    def test_explicit_league_word_wins(self):
        assert guess_sport_key("nba scores") == "basketball_nba"

    def test_nickname_inference(self):
        assert guess_sport_key("Lakers") == "basketball_nba"
        assert guess_sport_key("Patriots") == "americanfootball_nfl"

    def test_single_token_abbreviation(self):
        assert guess_sport_key("LAL") == "basketball_nba"

    def test_abbreviation_ignored_in_longer_phrase(self):
        # Abbreviations only count for single-token queries.
        assert guess_sport_key("LAL game tonight") is None

    def test_ambiguous_nickname_returns_none(self):
        # "Rangers" is both NHL (New York Rangers) and MLB (Texas Rangers).
        assert guess_sport_key("Rangers") is None

    def test_empty_query(self):
        assert guess_sport_key("") is None

    def test_unrecognized_query(self):
        assert guess_sport_key("purple monkey dishwasher") is None


class TestTeamMatches:
    def test_full_name_match(self):
        assert team_matches("Boston Celtics", "Boston Celtics")

    def test_last_word_match(self):
        assert team_matches("Lakers", "Los Angeles Lakers")

    def test_short_token_requires_whole_word(self):
        # "LA" must not match "Dallas Mavericks" via substring.
        assert not team_matches("LA", "Dallas Mavericks")

    def test_short_token_matches_abbreviation(self):
        assert team_matches("LAL", "Los Angeles Lakers")

    def test_multi_word_query(self):
        assert team_matches("Red Sox", "Boston Red Sox")

    def test_no_match(self):
        assert not team_matches("Lakers", "Boston Celtics")

    def test_empty_query_or_name(self):
        assert not team_matches("", "Boston Celtics")
        assert not team_matches("Celtics", "")
