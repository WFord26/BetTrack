# Sports Data MCP - Available Tools

Complete list of all MCP tools available for querying sports data and betting odds.

## The Odds API Tools (Betting Data)

### Core Odds Functions

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `get_available_sports` | List all available sports | `all_sports` (bool) |
| `get_odds` | Get betting odds for games | `sport`, `markets`, `regions` |
| `get_scores` | Get live/recent scores | `sport`, `days_from` |
| `get_event_odds` | Get odds for specific event | `sport`, `event_id`, `markets` |
| `search_odds` | Search for odds by team name | `query`, `sport`, `markets` |

### Supported Markets

**Game Markets:**
- `h2h` - Moneyline (head-to-head winner)
- `spreads` - Point spreads
- `totals` - Over/under totals
- `outrights` - Championship/tournament winners

**Player Props (NBA, NFL, NHL, MLB):**
- `player_points` - Player total points
- `player_rebounds` - Player total rebounds
- `player_assists` - Player total assists
- `player_threes` - Player 3-pointers made
- `player_double_double` - Player double-double
- `player_triple_double` - Player triple-double
- `player_blocks` - Player blocks
- `player_steals` - Player steals
- `player_turnovers` - Player turnovers
- `player_points_rebounds_assists` - Player combo prop
- `player_points_rebounds` - Player combo prop
- `player_points_assists` - Player combo prop
- `player_rebounds_assists` - Player combo prop
- `player_first_touchdown` - First TD scorer (NFL)
- `player_last_touchdown` - Last TD scorer (NFL)
- `player_anytime_touchdown` - Anytime TD scorer (NFL)
- `player_pass_tds` - Passing touchdowns (NFL)
- `player_pass_yds` - Passing yards (NFL)
- `player_pass_completions` - Pass completions (NFL)
- `player_pass_attempts` - Pass attempts (NFL)
- `player_pass_interceptions` - Interceptions thrown (NFL)
- `player_pass_longest_completion` - Longest completion (NFL)
- `player_rush_yds` - Rushing yards (NFL)
- `player_rush_attempts` - Rush attempts (NFL)
- `player_rush_longest` - Longest rush (NFL)
- `player_receptions` - Receptions (NFL)
- `player_reception_yds` - Receiving yards (NFL)
- `player_reception_longest` - Longest reception (NFL)
- `player_kicking_points` - Kicking points (NFL)
- `player_field_goals` - Field goals made (NFL)
- `player_tackles_assists` - Tackles + assists (NFL)
- `player_1st_td` - First touchdown (NFL)
- `player_sacks` - Sacks (NFL)
- `player_hits` - Hits (MLB)
- `player_total_bases` - Total bases (MLB)
- `player_runs` - Runs scored (MLB)
- `player_rbis` - RBIs (MLB)
- `player_home_runs` - Home runs (MLB)
- `player_singles` - Singles (MLB)
- `player_doubles` - Doubles (MLB)
- `player_triples` - Triples (MLB)
- `player_stolen_bases` - Stolen bases (MLB)
- `player_strikeouts` - Strikeouts (MLB pitcher)
- `player_walks` - Walks allowed (MLB pitcher)
- `player_earned_runs` - Earned runs (MLB pitcher)
- `player_hits_allowed` - Hits allowed (MLB pitcher)
- `player_shots_on_goal` - Shots on goal (NHL)
- `player_blocked_shots` - Blocked shots (NHL)
- `player_saves` - Saves (NHL goalie)
- `player_goals` - Goals scored (NHL/Soccer)
- `player_power_play_goals` - Power play goals (NHL)
- `player_short_handed_goals` - Short-handed goals (NHL)

### Formatted Odds Functions

| Tool Name | Description | Output Format |
|-----------|-------------|---------------|
| `get_odds_comparison` | Compare odds across bookmakers | Markdown table |
| `get_odds_card_artifact` | Interactive odds card | HTML/React artifact |

## ESPN API Tools (Sports Information)

### Scoreboard & Games

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `get_espn_scoreboard` | Raw ESPN scoreboard data | `sport`, `league`, `limit` |
| `get_formatted_scoreboard` | Formatted scoreboard table | `sport`, `league`, `limit` |
| `get_visual_scoreboard` | Interactive visual scoreboard | `sport`, `league`, `limit` |
| `get_matchup_cards` | Individual game cards | `sport`, `league`, `limit` |
| `get_detailed_scoreboard` | Quarter-by-quarter scores | `sport`, `league`, `limit` |
| `get_espn_game_summary` | Complete game details | `sport`, `league`, `event_id` |
| `get_comprehensive_game_info` | Game + odds combined | `sport`, `league`, `event_id` |

### Teams & Standings

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `get_espn_teams` | List all teams in league | `sport`, `league` |
| `get_espn_team_details` | Detailed team info | `sport`, `league`, `team_id` |
| `get_espn_team_schedule` | Team's schedule | `sport`, `league`, `team_id` |
| `get_espn_standings` | League standings | `sport`, `league`, `season` |
| `get_formatted_standings` | Formatted standings table | `sport`, `league` |

### News & Search

| Tool Name | Description | Key Parameters |
|-----------|-------------|----------------|
| `get_espn_news` | Latest sports news | `sport`, `league`, `limit` |
| `search_espn` | Search ESPN content | `query`, `limit` |

## Quick Reference

### Common Sport Keys
- `americanfootball_nfl` - NFL
- `basketball_nba` - NBA
- `icehockey_nhl` - NHL
- `baseball_mlb` - MLB
- `basketball_ncaab` - NCAA Men's Basketball
- `americanfootball_ncaaf` - NCAA Football
- `soccer_epl` - English Premier League
- `soccer_uefa_champs_league` - UEFA Champions League

### Common League Values (ESPN)
- NFL: `nfl`
- NBA: `nba`
- NHL: `nhl`
- MLB: `mlb`
- NCAA Football: `college-football`
- NCAA Basketball (M): `mens-college-basketball`
- NCAA Basketball (W): `womens-college-basketball`

### Regions
- `us` - United States
- `us2` - United States (alternative books)
- `uk` - United Kingdom
- `au` - Australia
- `eu` - Europe

## Tool Naming Conventions

- `get_*` - Retrieve specific data
- `search_*` - Query with natural language
- `get_formatted_*` - Returns formatted/styled output
- `get_visual_*` - Returns data for visual rendering
- `get_*_artifact` - Returns complete HTML/React components

## Usage Examples

```python
# Get NFL moneyline odds
get_odds("americanfootball_nfl", markets="h2h")

# Get NBA player props for points
get_odds("basketball_nba", markets="player_points")

# Get multiple markets at once
get_odds("basketball_nba", markets="h2h,spreads,player_points,player_rebounds")

# Search for specific team odds
search_odds("Lakers", sport="basketball_nba", markets="player_points")

# Get visual scoreboard for NFL
get_visual_scoreboard("football", "nfl")

# Get formatted standings
get_formatted_standings("basketball", "nba")
```

## Response Data Structures

### Odds Response
```json
{
  "success": true,
  "data": [
    {
      "id": "event_id",
      "sport_key": "basketball_nba",
      "commence_time": "2026-01-08T19:00:00Z",
      "home_team": "Los Angeles Lakers",
      "away_team": "Boston Celtics",
      "bookmakers": [
        {
          "key": "draftkings",
          "title": "DraftKings",
          "markets": [
            {
              "key": "h2h",
              "outcomes": [
                {"name": "Los Angeles Lakers", "price": -150},
                {"name": "Boston Celtics", "price": 130}
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Player Props Response
```json
{
  "markets": [
    {
      "key": "player_points",
      "outcomes": [
        {
          "description": "LeBron James",
          "name": "Over",
          "price": -110,
          "point": 25.5
        },
        {
          "description": "LeBron James",
          "name": "Under",
          "price": -110,
          "point": 25.5
        }
      ]
    }
  ]
}
```
