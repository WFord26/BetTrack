"""
Team Reference Data
===================
Quick reference tables for major sports leagues.
"""

from typing import Optional, Dict

# NFL Teams
NFL_TEAMS = {
    "Arizona Cardinals": {"id": "22", "abbr": "ARI", "division": "NFC West"},
    "Atlanta Falcons": {"id": "1", "abbr": "ATL", "division": "NFC South"},
    "Baltimore Ravens": {"id": "33", "abbr": "BAL", "division": "AFC North"},
    "Buffalo Bills": {"id": "2", "abbr": "BUF", "division": "AFC East"},
    "Carolina Panthers": {"id": "29", "abbr": "CAR", "division": "NFC South"},
    "Chicago Bears": {"id": "3", "abbr": "CHI", "division": "NFC North"},
    "Cincinnati Bengals": {"id": "4", "abbr": "CIN", "division": "AFC North"},
    "Cleveland Browns": {"id": "5", "abbr": "CLE", "division": "AFC North"},
    "Dallas Cowboys": {"id": "6", "abbr": "DAL", "division": "NFC East"},
    "Denver Broncos": {"id": "7", "abbr": "DEN", "division": "AFC West"},
    "Detroit Lions": {"id": "8", "abbr": "DET", "division": "NFC North"},
    "Green Bay Packers": {"id": "9", "abbr": "GB", "division": "NFC North"},
    "Houston Texans": {"id": "34", "abbr": "HOU", "division": "AFC South"},
    "Indianapolis Colts": {"id": "11", "abbr": "IND", "division": "AFC South"},
    "Jacksonville Jaguars": {"id": "30", "abbr": "JAX", "division": "AFC South"},
    "Kansas City Chiefs": {"id": "12", "abbr": "KC", "division": "AFC West"},
    "Las Vegas Raiders": {"id": "13", "abbr": "LV", "division": "AFC West"},
    "Los Angeles Chargers": {"id": "24", "abbr": "LAC", "division": "AFC West"},
    "Los Angeles Rams": {"id": "14", "abbr": "LAR", "division": "NFC West"},
    "Miami Dolphins": {"id": "15", "abbr": "MIA", "division": "AFC East"},
    "Minnesota Vikings": {"id": "16", "abbr": "MIN", "division": "NFC North"},
    "New England Patriots": {"id": "17", "abbr": "NE", "division": "AFC East"},
    "New Orleans Saints": {"id": "18", "abbr": "NO", "division": "NFC South"},
    "New York Giants": {"id": "19", "abbr": "NYG", "division": "NFC East"},
    "New York Jets": {"id": "20", "abbr": "NYJ", "division": "AFC East"},
    "Philadelphia Eagles": {"id": "21", "abbr": "PHI", "division": "NFC East"},
    "Pittsburgh Steelers": {"id": "23", "abbr": "PIT", "division": "AFC North"},
    "San Francisco 49ers": {"id": "25", "abbr": "SF", "division": "NFC West"},
    "Seattle Seahawks": {"id": "26", "abbr": "SEA", "division": "NFC West"},
    "Tampa Bay Buccaneers": {"id": "27", "abbr": "TB", "division": "NFC South"},
    "Tennessee Titans": {"id": "10", "abbr": "TEN", "division": "AFC South"},
    "Washington Commanders": {"id": "28", "abbr": "WAS", "division": "NFC East"}
}

# NBA Teams
NBA_TEAMS = {
    "Atlanta Hawks": {"id": "1", "abbr": "ATL", "division": "Southeast"},
    "Boston Celtics": {"id": "2", "abbr": "BOS", "division": "Atlantic"},
    "Brooklyn Nets": {"id": "17", "abbr": "BKN", "division": "Atlantic"},
    "Charlotte Hornets": {"id": "30", "abbr": "CHA", "division": "Southeast"},
    "Chicago Bulls": {"id": "4", "abbr": "CHI", "division": "Central"},
    "Cleveland Cavaliers": {"id": "5", "abbr": "CLE", "division": "Central"},
    "Dallas Mavericks": {"id": "6", "abbr": "DAL", "division": "Southwest"},
    "Denver Nuggets": {"id": "7", "abbr": "DEN", "division": "Northwest"},
    "Detroit Pistons": {"id": "8", "abbr": "DET", "division": "Central"},
    "Golden State Warriors": {"id": "9", "abbr": "GSW", "division": "Pacific"},
    "Houston Rockets": {"id": "10", "abbr": "HOU", "division": "Southwest"},
    "Indiana Pacers": {"id": "11", "abbr": "IND", "division": "Central"},
    "LA Clippers": {"id": "12", "abbr": "LAC", "division": "Pacific"},
    "Los Angeles Lakers": {"id": "13", "abbr": "LAL", "division": "Pacific"},
    "Memphis Grizzlies": {"id": "29", "abbr": "MEM", "division": "Southwest"},
    "Miami Heat": {"id": "14", "abbr": "MIA", "division": "Southeast"},
    "Milwaukee Bucks": {"id": "15", "abbr": "MIL", "division": "Central"},
    "Minnesota Timberwolves": {"id": "16", "abbr": "MIN", "division": "Northwest"},
    "New Orleans Pelicans": {"id": "3", "abbr": "NOP", "division": "Southwest"},
    "New York Knicks": {"id": "18", "abbr": "NYK", "division": "Atlantic"},
    "Oklahoma City Thunder": {"id": "25", "abbr": "OKC", "division": "Northwest"},
    "Orlando Magic": {"id": "19", "abbr": "ORL", "division": "Southeast"},
    "Philadelphia 76ers": {"id": "20", "abbr": "PHI", "division": "Atlantic"},
    "Phoenix Suns": {"id": "21", "abbr": "PHX", "division": "Pacific"},
    "Portland Trail Blazers": {"id": "22", "abbr": "POR", "division": "Northwest"},
    "Sacramento Kings": {"id": "23", "abbr": "SAC", "division": "Pacific"},
    "San Antonio Spurs": {"id": "24", "abbr": "SAS", "division": "Southwest"},
    "Toronto Raptors": {"id": "28", "abbr": "TOR", "division": "Atlantic"},
    "Utah Jazz": {"id": "26", "abbr": "UTA", "division": "Northwest"},
    "Washington Wizards": {"id": "27", "abbr": "WAS", "division": "Southeast"}
}

# NHL Teams
NHL_TEAMS = {
    "Anaheim Ducks": {"id": "25", "abbr": "ANA", "division": "Pacific"},
    "Arizona Coyotes": {"id": "28", "abbr": "ARI", "division": "Central"},
    "Boston Bruins": {"id": "6", "abbr": "BOS", "division": "Atlantic"},
    "Buffalo Sabres": {"id": "7", "abbr": "BUF", "division": "Atlantic"},
    "Calgary Flames": {"id": "20", "abbr": "CGY", "division": "Pacific"},
    "Carolina Hurricanes": {"id": "12", "abbr": "CAR", "division": "Metropolitan"},
    "Chicago Blackhawks": {"id": "16", "abbr": "CHI", "division": "Central"},
    "Colorado Avalanche": {"id": "21", "abbr": "COL", "division": "Central"},
    "Columbus Blue Jackets": {"id": "29", "abbr": "CBJ", "division": "Metropolitan"},
    "Dallas Stars": {"id": "25", "abbr": "DAL", "division": "Central"},
    "Detroit Red Wings": {"id": "17", "abbr": "DET", "division": "Atlantic"},
    "Edmonton Oilers": {"id": "22", "abbr": "EDM", "division": "Pacific"},
    "Florida Panthers": {"id": "13", "abbr": "FLA", "division": "Atlantic"},
    "Los Angeles Kings": {"id": "26", "abbr": "LAK", "division": "Pacific"},
    "Minnesota Wild": {"id": "30", "abbr": "MIN", "division": "Central"},
    "Montreal Canadiens": {"id": "8", "abbr": "MTL", "division": "Atlantic"},
    "Nashville Predators": {"id": "18", "abbr": "NSH", "division": "Central"},
    "New Jersey Devils": {"id": "1", "abbr": "NJD", "division": "Metropolitan"},
    "New York Islanders": {"id": "2", "abbr": "NYI", "division": "Metropolitan"},
    "New York Rangers": {"id": "3", "abbr": "NYR", "division": "Metropolitan"},
    "Ottawa Senators": {"id": "9", "abbr": "OTT", "division": "Atlantic"},
    "Philadelphia Flyers": {"id": "4", "abbr": "PHI", "division": "Metropolitan"},
    "Pittsburgh Penguins": {"id": "5", "abbr": "PIT", "division": "Metropolitan"},
    "San Jose Sharks": {"id": "28", "abbr": "SJS", "division": "Pacific"},
    "Seattle Kraken": {"id": "55", "abbr": "SEA", "division": "Pacific"},
    "St. Louis Blues": {"id": "19", "abbr": "STL", "division": "Central"},
    "Tampa Bay Lightning": {"id": "14", "abbr": "TBL", "division": "Atlantic"},
    "Toronto Maple Leafs": {"id": "10", "abbr": "TOR", "division": "Atlantic"},
    "Vancouver Canucks": {"id": "23", "abbr": "VAN", "division": "Pacific"},
    "Vegas Golden Knights": {"id": "54", "abbr": "VGK", "division": "Pacific"},
    "Washington Capitals": {"id": "15", "abbr": "WSH", "division": "Metropolitan"},
    "Winnipeg Jets": {"id": "52", "abbr": "WPG", "division": "Central"}
}


def get_team_reference_table(league: str) -> str:
    """
    Get formatted team reference table for a league.
    
    Args:
        league: League name (nfl, nba, nhl)
    
    Returns:
        Formatted table string
    """
    league = league.lower()
    
    if league == "nfl":
        teams = NFL_TEAMS
        title = "NFL TEAMS"
    elif league == "nba":
        teams = NBA_TEAMS
        title = "NBA TEAMS"
    elif league == "nhl":
        teams = NHL_TEAMS
        title = "NHL TEAMS"
    else:
        return f"Unknown league: {league}. Supported: nfl, nba, nhl"
    
    table = f"\n{'═' * 80}\n"
    table += f"{title:^80}\n"
    table += f"{'═' * 80}\n"
    table += f"{'TEAM':<35} {'ID':<8} {'ABBR':<8} {'DIVISION':<20}\n"
    table += f"{'─' * 80}\n"
    
    for team_name, info in sorted(teams.items()):
        table += f"{team_name:<35} {info['id']:<8} {info['abbr']:<8} {info['division']:<20}\n"
    
    table += f"{'═' * 80}\n"
    
    return table


def find_team_id(team_name: str, league: str) -> Optional[Dict]:
    """
    Find team ID by name or abbreviation.
    
    Args:
        team_name: Team name or abbreviation
        league: League (nfl, nba, nhl)
    
    Returns:
        Team info dict or None
    """
    league = league.lower()
    
    if league == "nfl":
        teams = NFL_TEAMS
    elif league == "nba":
        teams = NBA_TEAMS
    elif league == "nhl":
        teams = NHL_TEAMS
    else:
        return None
    
    team_name_lower = team_name.lower()
    
    # Check full name
    for name, info in teams.items():
        if team_name_lower in name.lower() or info['abbr'].lower() == team_name_lower:
            return {"name": name, **info}
    
    return None
