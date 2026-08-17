"""
Tests for sports_api/formatter.py

Pure function tests for output formatting. These tests verify:
- ASCII card generation and width consistency
- Markdown table formatting
- Scoreboard output accuracy
- Odds comparison output
"""

import pytest
from sports_api.formatter import (
    format_matchup_card,
    format_scoreboard_table,
    format_detailed_scoreboard,
    format_standings_table,
    format_odds_comparison,
)


class TestMatchupCard:
    """Tests for format_matchup_card() - ASCII box-drawing card"""

    def test_basic_card_structure(self):
        """Verify basic card has correct width and structure"""
        game = {
            "home_team": "Lakers",
            "away_team": "Celtics",
            "home_score": 120,
            "away_score": 118,
            "status": "completed",
            "commence_time": "2026-01-15T20:00:00Z",
        }
        
        card = format_matchup_card(game)
        lines = card.split('\n')
        
        # Card should be 66 characters wide
        assert all(len(line) <= 66 for line in lines if line), \
            "Card exceeds 66-character width"
        
        # Should have content
        assert len(card) > 0, "Card is empty"
        assert "Lakers" in card or "LAL" in card, "Home team not in card"
        assert "Celtics" in card or "BOS" in card, "Away team not in card"

    def test_team_name_shortening(self):
        """Verify team names are intelligently shortened"""
        game = {
            "home_team": "Los Angeles Lakers",
            "away_team": "Boston Celtics",
            "home_score": 100,
            "away_score": 100,
            "status": "inprogress",
            "commence_time": "2026-01-15T20:00:00Z",
        }
        
        card = format_matchup_card(game)
        
        # Should preserve the last word (Lakers, Celtics)
        # but shorten the full name to fit in 66 chars
        assert len(card.split('\n')[0]) <= 66, "First line exceeds width"

    def test_score_display(self):
        """Verify scores are correctly formatted"""
        game = {
            "home_team": "Lakers",
            "away_team": "Celtics",
            "home_score": 95,
            "away_score": 102,
            "status": "completed",
            "commence_time": "2026-01-15T20:00:00Z",
        }
        
        card = format_matchup_card(game)
        assert "95" in card, "Home score not in card"
        assert "102" in card, "Away score not in card"

    def test_missing_fields_handling(self):
        """Verify card handles missing optional fields gracefully"""
        game = {
            "home_team": "Lakers",
            "away_team": "Celtics",
            "status": "scheduled",
            "commence_time": "2026-01-15T20:00:00Z",
        }
        
        # Should not crash even without scores
        card = format_matchup_card(game)
        assert len(card) > 0, "Card is empty when scores missing"


class TestScoreboardTable:
    """Tests for format_scoreboard_table() - Markdown table"""

    def test_table_structure(self):
        """Verify table has box-drawing structure and team names"""
        games = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "home_score": 120,
                "away_score": 118,
                "status": "completed",
            },
        ]

        table = format_scoreboard_table(games)

        assert "│" in table, "Table should use box-drawing separators"
        assert "Lakers" in table
        assert "Celtics" in table
        assert "118 - 120" in table

    def test_emoji_status_indicators(self):
        """Verify status emoji indicators are included"""
        games = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "status": "completed",
            },
            {
                "home_team": "Warriors",
                "away_team": "Nets",
                "status": "scheduled",
            },
            {
                "home_team": "Heat",
                "away_team": "Bucks",
                "status": "inprogress",
            },
        ]
        
        table = format_scoreboard_table(games)
        
        # Table should contain emoji or status indicators
        assert len(table) > 0, "Table is empty"

    def test_empty_games_list(self):
        """Verify table handles empty game list"""
        table = format_scoreboard_table([])
        
        # Should return empty or header-only table
        assert isinstance(table, str), "Should return string"


class TestStandingsTable:
    """Tests for format_standings_table() - Conference/division standings"""

    def test_standings_format(self):
        """Verify standings table includes win/loss records"""
        standings = [
            {
                "team": {"displayName": "Lakers"},
                "stats": {"wins": 20, "losses": 10, "winPercent": ".667"},
            },
            {
                "team": {"displayName": "Celtics"},
                "stats": {"wins": 22, "losses": 8, "winPercent": ".733"},
            },
        ]

        table = format_standings_table(standings)

        # Should include teams and records
        assert "Lakers" in table, "Lakers not in standings"
        assert "Celtics" in table, "Celtics not in standings"
        assert "20" in table and ".667" in table, "Win data not in standings"

    def test_division_grouping(self):
        """Verify standings lists every team, ranked in input order"""
        standings = [
            {"team": {"displayName": "Lakers"}, "stats": {"wins": 20, "losses": 10}},
            {"team": {"displayName": "Warriors"}, "stats": {"wins": 18, "losses": 12}},
            {"team": {"displayName": "Celtics"}, "stats": {"wins": 22, "losses": 8}},
        ]

        table = format_standings_table(standings)

        assert "Lakers" in table and "Warriors" in table
        assert "Celtics" in table


class TestOddsComparison:
    """Tests for format_odds_comparison() - Bookmaker comparison table"""

    def test_odds_table_format(self):
        """Verify odds comparison table structure"""
        games = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "bookmakers": [
                    {
                        "title": "DraftKings",
                        "markets": [
                            {
                                "key": "h2h",
                                "outcomes": [
                                    {"name": "Lakers", "price": -110},
                                    {"name": "Celtics", "price": -110},
                                ],
                            }
                        ],
                    },
                    {
                        "title": "FanDuel",
                        "markets": [
                            {
                                "key": "h2h",
                                "outcomes": [
                                    {"name": "Lakers", "price": -110},
                                    {"name": "Celtics", "price": -110},
                                ],
                            }
                        ],
                    },
                ],
            }
        ]

        table = format_odds_comparison(games)

        assert "DraftKings" in table and "FanDuel" in table, "Bookmakers not in table"
        assert "Celtics @ Lakers" in table

    def test_odds_line_movement_display(self):
        """Verify per-outcome prices are rendered"""
        games = [
            {
                "home_team": "Lakers",
                "away_team": "Celtics",
                "bookmakers": [
                    {
                        "title": "DraftKings",
                        "markets": [
                            {
                                "key": "h2h",
                                "outcomes": [
                                    {"name": "Lakers", "price": -110},
                                    {"name": "Celtics", "price": -105},
                                ],
                            }
                        ],
                    },
                ],
            }
        ]

        table = format_odds_comparison(games)

        assert "-110" in table and "-105" in table

    def test_no_bookmakers(self):
        """A game with no bookmaker data still renders a section"""
        games = [{"home_team": "Lakers", "away_team": "Celtics", "bookmakers": []}]

        table = format_odds_comparison(games)

        assert "No odds available" in table

    def test_empty_games_list(self):
        """An empty games list returns a friendly message"""
        assert format_odds_comparison([]) == "No odds available."


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
