"""
Tests for sports_api/tools/artifact_tools.py helpers.

The odds card used to be one 260-line function, so the only thing reachable
from a test was "did it return a dict". These cover the pieces the card is
now built from: turning a bookmaker's nested markets into a flat row,
picking the best price across books, and embedding that data in the
component source.

Registration and the not-configured/no-games paths are covered in
test_tools_registration.py.
"""

import json

import pytest

from sports_api.tools.artifact_tools import (
    _best_focus_odds,
    _extract_book_odds,
    _league_for,
    _render_odds_card,
)

HOME = "Denver Nuggets"
AWAY = "Los Angeles Lakers"


def make_book(title="DraftKings", h2h=True, spreads=True, totals=True):
    """A bookmaker shaped like an Odds API response, with markets selectable."""
    markets = []
    if h2h:
        markets.append({"key": "h2h", "outcomes": [
            {"name": HOME, "price": 150},
            {"name": AWAY, "price": -170},
        ]})
    if spreads:
        markets.append({"key": "spreads", "outcomes": [
            {"name": HOME, "point": 3.5, "price": -108},
            {"name": AWAY, "point": -3.5, "price": -112},
        ]})
    if totals:
        markets.append({"key": "totals", "outcomes": [
            {"name": "Over", "point": 224.5, "price": -105},
            {"name": "Under", "point": 224.5, "price": -115},
        ]})
    return {"title": title, "markets": markets}


class TestExtractBookOdds:
    def test_reads_every_market(self):
        assert _extract_book_odds(make_book(), HOME, AWAY) == {
            "name": "DraftKings",
            "ml_home": 150,
            "ml_away": -170,
            "spread_home": 3.5,
            "spread_away": -3.5,
            "spread_home_juice": -108,
            "spread_away_juice": -112,
            "total_line": 224.5,
            "total_over": -105,
            "total_under": -115,
        }

    def test_book_with_no_markets_falls_back(self):
        """Books that price nothing must still yield a renderable row."""
        row = _extract_book_odds({"title": "Sparse"}, HOME, AWAY)
        assert row["ml_home"] == row["ml_away"] == 0
        assert row["spread_home"] == row["spread_away"] == 0
        assert row["total_line"] == row["total_over"] == row["total_under"] == 0
        # Juice is the only field whose default is a real price, not zero.
        assert row["spread_home_juice"] == row["spread_away_juice"] == -110

    def test_partial_markets_do_not_disturb_others(self):
        row = _extract_book_odds(make_book(spreads=False), HOME, AWAY)
        assert row["ml_home"] == 150
        assert row["total_line"] == 224.5
        assert row["spread_home"] == 0
        assert row["spread_home_juice"] == -110

    def test_missing_under_keeps_line_from_over(self):
        book = {"title": "OverOnly", "markets": [
            {"key": "totals", "outcomes": [{"name": "Over", "point": 210.5, "price": -104}]},
        ]}
        row = _extract_book_odds(book, HOME, AWAY)
        assert row["total_line"] == 210.5
        assert row["total_over"] == -104
        assert row["total_under"] == 0

    def test_outcomes_for_other_teams_are_ignored(self):
        """Team names are matched exactly, so a mismatch must not leak in."""
        book = {"title": "Wrong", "markets": [
            {"key": "h2h", "outcomes": [
                {"name": "Boston Celtics", "price": 999},
                {"name": "Miami Heat", "price": -999},
            ]},
        ]}
        row = _extract_book_odds(book, HOME, AWAY)
        assert row["ml_home"] == 0
        assert row["ml_away"] == 0

    def test_untitled_book_gets_empty_name(self):
        assert _extract_book_odds({"markets": []}, HOME, AWAY)["name"] == ""


class TestBestFocusOdds:
    def test_picks_highest_home_price_when_focus_is_home(self):
        books = [
            _extract_book_odds(make_book("A"), HOME, AWAY),
            _extract_book_odds(make_book("B"), HOME, AWAY),
        ]
        books[1]["ml_home"] = 165
        books[1]["spread_home"] = 4.5
        assert _best_focus_odds(books, is_home=True) == (165, 4.5)

    def test_reads_the_away_side_when_focus_is_away(self):
        books = [_extract_book_odds(make_book(), HOME, AWAY)]
        books[0]["ml_away"] = 120
        # The home side is the larger number; the away side must still win.
        assert _best_focus_odds(books, is_home=False) == (120, -3.5)

    def test_unpriced_moneylines_are_excluded(self):
        """0 means 'not priced'; a book that priced nothing must not win."""
        books = [
            _extract_book_odds(make_book("A"), HOME, AWAY),
            _extract_book_odds({"title": "Sparse"}, HOME, AWAY),
        ]
        assert _best_focus_odds(books, is_home=True)[0] == 150

    def test_all_negative_moneylines_yield_zero(self):
        """Known quirk: favourites are filtered out by the >0 rule."""
        books = [_extract_book_odds(make_book(), HOME, AWAY)]
        assert _best_focus_odds(books, is_home=False)[0] == 0

    def test_no_books_is_not_an_error(self):
        assert _best_focus_odds([], is_home=True) == (0, 0)


class TestLeagueFor:
    @pytest.mark.parametrize("sport,league", [
        ("americanfootball_nfl", "nfl"),
        ("basketball_nba", "nba"),
        ("icehockey_nhl", "nhl"),
    ])
    def test_known_sports(self, sport, league):
        assert _league_for(sport) == league

    def test_unknown_sport_defaults_to_nfl(self):
        assert _league_for("baseball_mlb") == "nfl"


def render(books, **overrides):
    kwargs = dict(
        sport="basketball_nba",
        commence_time="2026-08-20T02:00:00Z",
        focus_team=HOME,
        other_team=AWAY,
        focus_abbr="NUG",
        is_home=True,
        focus_logo="https://example.test/home.png",
        other_logo="https://example.test/away.png",
        books_data=books,
        best_ml=150,
        best_spread=3.5,
    )
    kwargs.update(overrides)
    return _render_odds_card(**kwargs)


def embedded_books(source):
    """Parse the `const books = [...]` array back out of the component."""
    line = next(l for l in source.splitlines() if "const books =" in l)
    return json.loads(line.split("=", 1)[1].strip().rstrip(";"))


class TestRenderOddsCard:
    def test_book_data_round_trips_as_json(self):
        books = [_extract_book_odds(make_book(), HOME, AWAY)]
        assert embedded_books(render(books)) == books

    def test_apostrophe_in_book_name_survives(self):
        """Regression: a repr-based embed turned "Bally's" into invalid JS."""
        books = [_extract_book_odds(make_book("Bally's Bet"), HOME, AWAY)]
        assert embedded_books(render(books))[0]["name"] == "Bally's Bet"

    def test_booleans_are_javascript_literals(self):
        """Python's True would be a ReferenceError in the browser."""
        assert "const isHome = true;" in render([], is_home=True)
        assert "const isHome = false;" in render([], is_home=False)

    def test_focus_team_and_abbreviation_are_embedded(self):
        source = render([], focus_abbr="LAL", focus_team="Los Angeles Lakers")
        assert 'const focusTeam = "Los Angeles Lakers";' in source
        assert "LAL ML" in source

    def test_league_badge_comes_from_sport_key(self):
        assert "NBA" in render([], sport="basketball_nba")
        assert "NFL" in render([], sport="americanfootball_nfl")
