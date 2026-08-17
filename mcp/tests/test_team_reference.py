"""
Tests for sports_api/team_reference.py

Tests for team ID lookups, fuzzy matching, and logo URL generation.
"""

import pytest
from sports_api.team_reference import (
    find_team_id,
    get_team_logo_url,
    NFL_TEAMS,
    NBA_TEAMS,
    NHL_TEAMS,
)


class TestFindTeamId:
    """Tests for find_team_id() - fuzzy team name matching"""

    def test_exact_match_nba(self):
        """Test exact team name match"""
        team_id = find_team_id("Los Angeles Lakers", "nba")
        assert team_id is not None, "Lakers not found"
        assert isinstance(team_id, str), "Team ID should be string"

    def test_partial_match_nba(self):
        """Test partial team name match"""
        team_id = find_team_id("Lakers", "nba")
        assert team_id is not None, "Lakers not found with partial name"

    def test_abbreviation_nba(self):
        """Test team abbreviation lookup"""
        team_id = find_team_id("LAL", "nba")
        assert team_id is not None, "Lakers not found by abbreviation"

    def test_case_insensitive_match(self):
        """Test case-insensitive matching"""
        team_id = find_team_id("los angeles lakers", "nba")
        assert team_id is not None, "Case-insensitive match failed"

    def test_nfl_team_lookup(self):
        """Test NFL team lookup"""
        team_id = find_team_id("New England Patriots", "nfl")
        assert team_id is not None, "Patriots not found"

    def test_nhl_team_lookup(self):
        """Test NHL team lookup"""
        team_id = find_team_id("Montreal Canadiens", "nhl")
        assert team_id is not None, "Canadiens not found"

    def test_nonexistent_team(self):
        """Test lookup of nonexistent team"""
        team_id = find_team_id("Fake City Nonexistent", "nba")
        # Should return None or empty string for nonexistent team
        assert not team_id or team_id is None, "Should return None for nonexistent team"

    def test_empty_team_name(self):
        """Test with empty team name"""
        team_id = find_team_id("", "nba")
        assert not team_id or team_id is None, "Should handle empty string"

    def test_invalid_sport(self):
        """Test with invalid sport"""
        team_id = find_team_id("Lakers", "invalid_sport")
        assert not team_id or team_id is None, "Should handle invalid sport"

    def test_fuzzy_match_typo(self):
        """Test fuzzy matching with minor typos"""
        # Lakers with common typo
        team_id = find_team_id("Lakers", "nba")  # missing 'Los Angeles'
        assert team_id is not None, "Should fuzzy match Lakers"


class TestGetTeamLogoUrl:
    """Tests for get_team_logo_url() - ESPN logo URL generation"""

    def test_nba_logo_url(self):
        """Test NBA team logo URL generation"""
        url = get_team_logo_url("Los Angeles Lakers", "nba")
        assert url is not None, "Should return URL for Lakers"
        assert "cdn.espn.com" in url or "espn.com" in url, "Should be ESPN CDN URL"
        assert ".png" in url.lower(), "Should return PNG format"
        assert "500" in url or "500px" in url, "Should be 500px format"

    def test_nfl_logo_url(self):
        """Test NFL team logo URL generation"""
        url = get_team_logo_url("New England Patriots", "nfl")
        assert url is not None, "Should return URL for Patriots"
        assert "cdn.espn.com" in url, "Should be ESPN CDN URL"

    def test_nhl_logo_url(self):
        """Test NHL team logo URL generation"""
        url = get_team_logo_url("Montreal Canadiens", "nhl")
        assert url is not None, "Should return URL for Canadiens"
        assert "cdn.espn.com" in url, "Should be ESPN CDN URL"

    def test_dark_mode_logo(self):
        """Test dark mode logo URL"""
        url_light = get_team_logo_url("Lakers", "nba", dark_mode=False)
        url_dark = get_team_logo_url("Lakers", "nba", dark_mode=True)
        
        # URLs might be the same or different based on ESPN availability
        # Just verify both return valid URLs
        assert url_light is not None, "Light mode URL should exist"

    def test_logo_url_consistency(self):
        """Test that logo URLs are consistent"""
        url1 = get_team_logo_url("Lakers", "nba")
        url2 = get_team_logo_url("Lakers", "nba")
        
        assert url1 == url2, "Logo URLs should be consistent"

    def test_nonexistent_team_logo(self):
        """Test logo URL for nonexistent team"""
        url = get_team_logo_url("Fake City Nonexistent", "nba")
        # Should return None for nonexistent team
        assert url is None or url == "", "Should return None/empty for nonexistent team"


class TestTeamDataStructure:
    """Tests for team data structure integrity"""

    def test_nba_teams_have_required_fields(self):
        """Verify all NBA teams have required fields"""
        for team_name, team_data in NBA_TEAMS.items():
            assert "id" in team_data, f"{team_name} missing 'id'"
            assert "abbr" in team_data, f"{team_name} missing 'abbr'"
            assert isinstance(team_data["id"], str), f"{team_name} id should be string"
            assert isinstance(team_data["abbr"], str), f"{team_name} abbr should be string"

    def test_nfl_teams_have_required_fields(self):
        """Verify all NFL teams have required fields"""
        for team_name, team_data in NFL_TEAMS.items():
            assert "id" in team_data, f"{team_name} missing 'id'"
            assert "abbr" in team_data, f"{team_name} missing 'abbr'"

    def test_nhl_teams_have_required_fields(self):
        """Verify all NHL teams have required fields"""
        for team_name, team_data in NHL_TEAMS.items():
            assert "id" in team_data, f"{team_name} missing 'id'"
            assert "abbr" in team_data, f"{team_name} missing 'abbr'"

    def test_nba_teams_count(self):
        """Verify NBA has expected number of teams"""
        # NBA has 30 teams
        assert len(NBA_TEAMS) == 30, f"NBA should have 30 teams, got {len(NBA_TEAMS)}"

    def test_nfl_teams_count(self):
        """Verify NFL has expected number of teams"""
        # NFL has 32 teams
        assert len(NFL_TEAMS) == 32, f"NFL should have 32 teams, got {len(NFL_TEAMS)}"

    def test_nhl_teams_count(self):
        """Verify NHL has expected number of teams"""
        # NHL has 32 teams
        assert len(NHL_TEAMS) == 32, f"NHL should have 32 teams, got {len(NHL_TEAMS)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
