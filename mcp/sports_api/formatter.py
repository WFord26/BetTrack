"""
Sports Data Formatter
=====================
Formats sports data into readable tables and cards.
"""

from typing import Dict, List, Optional
from datetime import datetime


def format_matchup_card(game: Dict) -> str:
    """
    Format a single game into a visually appealing matchup card.
    
    Args:
        game: Game data dictionary
    
    Returns:
        Formatted matchup card string
    """
    home_team = game.get('home_team', 'Home')
    away_team = game.get('away_team', 'Away')
    commence_time = game.get('commence_time', '')
    
    # Parse time if available
    time_str = "TBD"
    if commence_time:
        try:
            dt = datetime.fromisoformat(commence_time.replace('Z', '+00:00'))
            time_str = dt.strftime('%a, %b %d @ %I:%M %p')
        except:
            time_str = commence_time
    
    # Get scores if available
    home_score = game.get('home_score', '')
    away_score = game.get('away_score', '')
    
    # Shorten team names intelligently
    def shorten_name(name: str, max_len: int = 24) -> str:
        if len(name) <= max_len:
            return name
        # Try to keep last word (usually team name like "Lakers", "Celtics")
        words = name.split()
        if len(words) > 1:
            # Keep first words + last word if possible
            last_word = words[-1]
            if len(last_word) <= max_len - 3:
                remaining = max_len - len(last_word) - 1
                first_part = ' '.join(words[:-1])
                if len(first_part) <= remaining:
                    return name
                else:
                    return first_part[:remaining-2] + '... ' + last_word
        # Fall back to simple truncation with ellipsis
        return name[:max_len-3] + '...'
    
    away_short = shorten_name(away_team)
    home_short = shorten_name(home_team)
    
    # Build card with better spacing and alignment
    width = 66
    card = f"""
┌{'─' * (width - 2)}┐
│{' ' * (width - 2)}│
│{'MATCHUP'.center(width - 2)}│
│{' ' * (width - 2)}│
├{'─' * (width - 2)}┤
│{' ' * (width - 2)}│
"""
    
    # Team matchup line with centered "vs"
    matchup = f"{away_short}  vs  {home_short}"
    card += f"│{matchup.center(width - 2)}│\n"
    card += f"│{' ' * (width - 2)}│\n"
    
    # Show scores if game started/ended
    if home_score and away_score:
        score_line = f"{away_score}  -  {home_score}"
        card += f"│{score_line.center(width - 2)}│\n"
        card += f"│{' ' * (width - 2)}│\n"
    
    # Time/date
    card += f"│{time_str.center(width - 2)}│\n"
    
    # Add broadcast info if available (from ESPN API)
    broadcasts = game.get('broadcasts', [])
    if broadcasts:
        # Get national broadcasts (most relevant)
        national = [b for b in broadcasts if b.get('type', {}).get('shortName') in ['', 'National']]
        if not national:
            national = broadcasts[:2]  # Fall back to first 2
        
        channels = []
        for b in national[:2]:
            names = b.get('names', [])
            if names:
                channels.extend(names[:2])  # Max 2 from each broadcast entry
        
        if channels:
            channel_str = ', '.join(channels[:3])  # Show max 3 channels
            if len(channel_str) <= width - 8:
                card += f"│{'TV: ' + channel_str:^{width - 2}}│\n"
    
    # Add weather info if available (outdoor stadiums)
    weather = game.get('weather', {})
    if weather:
        temp = weather.get('temperature')
        conditions = weather.get('condition', weather.get('displayValue', ''))
        wind = weather.get('wind', '')
        
        weather_parts = []
        if temp:
            weather_parts.append(f"{temp}°F")
        if conditions:
            weather_parts.append(conditions)
        if wind:
            weather_parts.append(wind)
        
        if weather_parts:
            weather_str = ', '.join(weather_parts)
            if len(weather_str) <= width - 8:
                card += f"│{'Weather: ' + weather_str:^{width - 2}}│\n"
    
    # Add odds if available - show multiple bookmakers
    bookmakers = game.get('bookmakers', [])
    if bookmakers:
        # Show up to 3 bookmakers
        for bm_idx, bm in enumerate(bookmakers[:3]):
            bm_name = bm.get('title', 'Bookmaker')
            markets = bm.get('markets', [])
            if markets:
                market = markets[0]
                market_type = market.get('key', 'h2h')
                outcomes = market.get('outcomes', [])
                if outcomes:
                    if bm_idx == 0:
                        card += f"│{' ' * (width - 2)}│\n"
                        card += f"│{'─' * (width - 2)}│\n"
                    
                    # Market header
                    if market_type == 'h2h':
                        header = f"Moneyline ({bm_name})"
                    elif market_type == 'spreads':
                        header = f"Spread ({bm_name})"
                    else:
                        header = f"Odds ({bm_name})"
                    card += f"│{header.center(width - 2)}│\n"
                    card += f"│{' ' * (width - 2)}│\n"
                    
                    # Format odds with better spacing
                    for outcome in outcomes[:2]:
                        name = shorten_name(outcome.get('name', ''), 28)
                        price = outcome.get('price', '')
                        point = outcome.get('point', '')
                        
                        # Format price with + for positive odds
                        if isinstance(price, (int, float)):
                            if price > 0:
                                price_str = f"+{int(price)}"
                            else:
                                price_str = str(int(price))
                        else:
                            price_str = str(price)
                        
                        # Add point if spread
                        if point:
                            price_str = f"{price_str} ({point:+.1f})"
                        
                        # Better alignment: left-align name, right-align odds with consistent spacing
                        # Total usable width: 64 (66 - 2 for borders)
                        # Padding: 2 left + 2 right = 4
                        # Available: 60 chars
                        name_width = 52  # Space for team name
                        odds_width = 8   # Space for odds
                        card += f"│  {name:<{name_width}}{price_str:>{odds_width}}  │\n"
                    
                    # Add spacing between bookmakers
                    if bm_idx < min(len(bookmakers), 3) - 1:
                        card += f"│{' ' * (width - 2)}│\n"
    
    card += f"│{' ' * (width - 2)}│\n"
    card += f"└{'─' * (width - 2)}┘"
    
    return card


def format_scoreboard_table(games: List[Dict]) -> str:
    """
    Format multiple games into a table.
    
    Args:
        games: List of game dictionaries
    
    Returns:
        Formatted table string
    """
    if not games:
        return "No games found."
    
    table = "\n"
    table += "┌" + "─" * 100 + "┐\n"
    table += "│ " + "AWAY TEAM".ljust(20) + "│ " + "HOME TEAM".ljust(20) + "│ " + "SCORE".ljust(15) + "│ " + "TIME/STATUS".ljust(35) + " │\n"
    table += "├" + "─" * 100 + "┤\n"
    
    for game in games[:15]:  # Limit to 15 games
        away = game.get('away_team', game.get('awayTeam', {}).get('name', 'TBD'))[:20]
        home = game.get('home_team', game.get('homeTeam', {}).get('name', 'TBD'))[:20]
        
        # Try different score formats
        away_score = game.get('away_score', game.get('awayTeam', {}).get('score', '-'))
        home_score = game.get('home_score', game.get('homeTeam', {}).get('score', '-'))
        score = f"{away_score} - {home_score}"
        
        # Try different time formats
        time_str = game.get('commence_time', '')
        status = game.get('status', {})
        if isinstance(status, dict):
            time_str = status.get('type', {}).get('detail', time_str)
        
        if time_str and 'T' in time_str:
            try:
                dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                time_str = dt.strftime('%a %m/%d %I:%M %p')
            except:
                pass
        
        table += f"│ {away.ljust(20)} │ {home.ljust(20)} │ {score.ljust(15)} │ {time_str[:35].ljust(35)} │\n"
    
    table += "└" + "─" * 100 + "┘\n"
    
    return table


def format_detailed_scoreboard(games: List[Dict], sport: str = 'basketball') -> str:
    """
    Format games with quarter/period-by-period scores.
    
    Args:
        games: List of ESPN game dictionaries with competition data
        sport: Sport type (basketball, football, hockey) for period labels
    
    Returns:
        Formatted detailed scoreboard with period scores
    """
    if not games:
        return "No games found."
    
    # Period labels by sport
    period_labels = {
        'basketball': ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
        'football': ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
        'hockey': ['P1', 'P2', 'P3', 'OT', 'SO']
    }
    labels = period_labels.get(sport, ['Q1', 'Q2', 'Q3', 'Q4'])
    
    table = "\n"
    
    for game in games[:10]:  # Limit to 10 games for detailed view
        # Extract game data from ESPN structure
        if 'competitions' in game:
            comp = game['competitions'][0]
            competitors = comp.get('competitors', [])
            
            if len(competitors) < 2:
                continue
            
            # Get away/home teams (order: 0=home, 1=away in ESPN API)
            away_comp = next((c for c in competitors if c.get('homeAway') == 'away'), competitors[1])
            home_comp = next((c for c in competitors if c.get('homeAway') == 'home'), competitors[0])
            
            away_team = away_comp.get('team', {}).get('displayName', 'Away')
            home_team = home_comp.get('team', {}).get('displayName', 'Home')
            away_score = away_comp.get('score', '0')
            home_score = home_comp.get('score', '0')
            
            # Get period scores
            away_line = away_comp.get('linescores', [])
            home_line = home_comp.get('linescores', [])
            
            # Status and weather
            status = comp.get('status', {}).get('type', {}).get('detail', 'TBD')
            weather = comp.get('weather', {})
            
            # Build game card
            width = 90
            table += f"┌{'─' * (width - 2)}┐\n"
            table += f"│{game.get('name', 'Game').center(width - 2)}│\n"
            table += f"├{'─' * (width - 2)}┤\n"
            
            # Header row with period labels
            header = f"│ {'TEAM':<22} │ "
            for i, label in enumerate(labels):
                if i < len(away_line) or i < len(home_line):
                    header += f"{label:^6} │ "
            header += f"{'TOTAL':^6} │"
            table += header + "\n"
            table += f"├{'─' * (width - 2)}┤\n"
            
            # Away team row
            away_row = f"│ {away_team[:22]:<22} │ "
            for i in range(len(away_line)):
                score_val = away_line[i].get('value', away_line[i]) if isinstance(away_line[i], dict) else away_line[i]
                away_row += f"{str(score_val):^6} │ "
            away_row += f"{away_score:^6} │"
            table += away_row + "\n"
            
            # Home team row
            home_row = f"│ {home_team[:22]:<22} │ "
            for i in range(len(home_line)):
                score_val = home_line[i].get('value', home_line[i]) if isinstance(home_line[i], dict) else home_line[i]
                home_row += f"{str(score_val):^6} │ "
            home_row += f"{home_score:^6} │"
            table += home_row + "\n"
            
            # Footer with status and weather
            table += f"├{'─' * (width - 2)}┤\n"
            footer_items = [status]
            if weather:
                temp = weather.get('temperature')
                cond = weather.get('displayValue', weather.get('condition', ''))
                if temp and cond:
                    footer_items.append(f"Weather: {temp}°F, {cond}")
                elif temp:
                    footer_items.append(f"Weather: {temp}°F")
                elif cond:
                    footer_items.append(f"Weather: {cond}")
            
            footer_str = ' • '.join(footer_items)
            table += f"│{footer_str.center(width - 2)}│\n"
            table += f"└{'─' * (width - 2)}┘\n\n"
    
    return table


def format_standings_table(standings: List[Dict]) -> str:
    """
    Format league standings into a table.
    
    Args:
        standings: List of team standings
    
    Returns:
        Formatted standings table
    """
    if not standings:
        return "No standings data available."
    
    table = "\n"
    table += "┌" + "─" * 80 + "┐\n"
    table += "│ " + "RANK".ljust(5) + "│ " + "TEAM".ljust(30) + "│ " + "W".ljust(5) + "│ " + "L".ljust(5) + "│ " + "PCT".ljust(8) + "│ " + "GB".ljust(6) + " │\n"
    table += "├" + "─" * 80 + "┤\n"
    
    for idx, team in enumerate(standings[:16], 1):
        name = team.get('team', {}).get('displayName', 'Unknown')[:30]
        wins = team.get('stats', {}).get('wins', '0')
        losses = team.get('stats', {}).get('losses', '0')
        pct = team.get('stats', {}).get('winPercent', '0.000')
        gb = team.get('stats', {}).get('gamesBehind', '-')
        
        table += f"│ {str(idx).ljust(5)} │ {name.ljust(30)} │ {str(wins).ljust(5)} │ {str(losses).ljust(5)} │ {str(pct).ljust(8)} │ {str(gb).ljust(6)} │\n"
    
    table += "└" + "─" * 80 + "┘\n"
    
    return table


def format_odds_comparison(games: List[Dict]) -> str:
    """
    Format odds comparison for multiple bookmakers.
    
    Args:
        games: List of games with odds
    
    Returns:
        Formatted odds comparison
    """
    if not games:
        return "No odds available."
    
    result = []
    
    for game in games[:5]:  # Limit to 5 games
        away = game.get('away_team', 'Away')
        home = game.get('home_team', 'Home')
        
        result.append(f"\n{'═' * 70}")
        result.append(f"{away} @ {home}")
        result.append(f"{'─' * 70}")
        
        bookmakers = game.get('bookmakers', [])
        if bookmakers:
            for bm in bookmakers[:3]:  # Show top 3 bookmakers
                bm_name = bm.get('title', 'Unknown')
                markets = bm.get('markets', [])
                
                if markets:
                    market = markets[0]
                    market_name = market.get('key', 'h2h')
                    outcomes = market.get('outcomes', [])
                    
                    odds_str = " | ".join([f"{o.get('name', '')}: {o.get('price', '')}" for o in outcomes])
                    result.append(f"  {bm_name:20} ({market_name}): {odds_str}")
        else:
            result.append("  No odds available")
    
    return "\n".join(result)


def format_game_summary(game_data: Dict) -> str:
    """
    Format comprehensive game summary with stats, scores, and highlights.
    
    Args:
        game_data: ESPN game summary data
    
    Returns:
        Formatted game card with all details
    """
    width = 66
    card = []
    
    # Header
    card.append(f"┌{'─' * (width - 2)}┐")
    
    # Game status and date
    status = game_data.get('header', {}).get('competitions', [{}])[0].get('status', {})
    status_text = status.get('type', {}).get('detail', 'Game')
    venue = game_data.get('gameInfo', {}).get('venue', {}).get('fullName', '')
    
    card.append(f"│{status_text.center(width - 2)}│")
    if venue:
        card.append(f"│{('@ ' + venue).center(width - 2)}│")
    card.append(f"├{'─' * (width - 2)}┤")
    card.append(f"│{' ' * (width - 2)}│")
    
    # Teams and scores
    teams = game_data.get('boxscore', {}).get('teams', [])
    if len(teams) >= 2:
        for team in teams:
            team_name = team.get('team', {}).get('displayName', '').upper()
            record = team.get('team', {}).get('record', '')
            score = team.get('statistics', [{}])[-1].get('displayValue', '0')  # Final score
            
            line = f"   {team_name} ({record})".ljust(42) + f"{score} ".rjust(width - 44)
            card.append(f"│{line}│")
    
    card.append(f"│{' ' * (width - 2)}│")
    
    # Quarter-by-quarter scores
    card.append(f"├{'─' * (width - 2)}┤")
    card.append(f"│{'QUARTER-BY-QUARTER'.center(width - 2)}│")
    card.append(f"│{' ' * (width - 2)}│")
    
    # Period headers
    linescores = teams[0].get('linescores', []) if teams else []
    period_count = len(linescores)
    
    header = "            "
    for i in range(period_count):
        if i < 4:
            header += f"Q{i+1}   "
        else:
            header += "OT   "
    header += "FINAL"
    card.append(f"│{header.ljust(width - 2)}│")
    
    # Team scores by period
    for team in teams:
        abbr = team.get('team', {}).get('abbreviation', 'TM')
        line = f"   {abbr:7}"
        
        for ls in team.get('linescores', []):
            score = ls.get('displayValue', '0')
            line += f"{score:>5}"
        
        # Final score
        final = team.get('statistics', [{}])[-1].get('displayValue', '0')
        line += f"{final:>7}"
        
        card.append(f"│{line.ljust(width - 2)}│")
    
    card.append(f"│{' ' * (width - 2)}│")
    
    # Team stats
    card.append(f"├{'─' * (width - 2)}┤")
    card.append(f"│{'TEAM STATS'.center(width - 2)}│")
    card.append(f"│{' ' * (width - 2)}│")
    
    # Stats header
    abbr1 = teams[0].get('team', {}).get('abbreviation', 'TM1') if len(teams) > 0 else 'TM1'
    abbr2 = teams[1].get('team', {}).get('abbreviation', 'TM2') if len(teams) > 1 else 'TM2'
    stat_header = f"             {abbr1:^21} {abbr2:^21}"
    card.append(f"│{stat_header.ljust(width - 2)}│")
    
    # Key stats (FG%, 3P%, FT%, REB, AST)
    stat_labels = {
        'fieldGoalPct': 'FG%',
        'threePointPct': '3P%',
        'freeThrowPct': 'FT%',
        'rebounds': 'REB',
        'assists': 'AST'
    }
    
    stats_data = [{}, {}]
    for idx, team in enumerate(teams[:2]):
        for stat in team.get('statistics', []):
            name = stat.get('name', '')
            if name in stat_labels:
                stats_data[idx][name] = stat.get('displayValue', '-')
    
    for stat_key, label in stat_labels.items():
        val1 = stats_data[0].get(stat_key, '-')
        val2 = stats_data[1].get(stat_key, '-')
        
        # Add one space after label for alignment
        stat_line = f"   {label:8} {val1:^21} {val2:^21}"
        card.append(f"│{stat_line.ljust(width - 2)}│")
    
    card.append(f"│{' ' * (width - 2)}│")
    
    # Top performers
    card.append(f"├{'─' * (width - 2)}┤")
    card.append(f"│{'TOP PERFORMERS'.center(width - 2)}│")
    card.append(f"│{' ' * (width - 2)}│")
    
    for team in teams:
        team_name = team.get('team', {}).get('displayName', '').upper()
        card.append(f"│   {team_name.ljust(width - 6)} │")
        
        # Get top 3 players
        players = team.get('players', [])[:3]
        for player in players:
            name = player.get('athlete', {}).get('displayName', '')
            stats = player.get('stats', [])
            stat_str = ', '.join(stats[:4]) if stats else ''
            
            player_line = f"   {name:20} {stat_str}"
            card.append(f"│{player_line.ljust(width - 2)}│")
        
        card.append(f"│{' ' * (width - 2)}│")
    
    # Game notes
    notes = game_data.get('article', {}).get('story', '')
    if notes:
        card.append(f"├{'─' * (width - 2)}┤")
        card.append(f"│{'GAME NOTES'.center(width - 2)}│")
        card.append(f"│{' ' * (width - 2)}│")
        
        # Wrap text
        import textwrap
        wrapped = textwrap.wrap(notes, width - 8)
        for line in wrapped[:5]:  # Max 5 lines
            card.append(f"│   {line.ljust(width - 6)} │")
        
        card.append(f"│{' ' * (width - 2)}│")
    
    # Footer (TV, attendance)
    card.append(f"├{'─' * (width - 2)}┤")
    card.append(f"│{'GAME NOTES'.center(width - 2)}│")
    card.append(f"│{' ' * (width - 2)}│")
    
    broadcasts = game_data.get('gameInfo', {}).get('broadcast', {}).get('broadcasters', [])
    if broadcasts:
        tv = ', '.join([b.get('names', [''])[0] for b in broadcasts[:2]])
        card.append(f"│   TV: {tv.ljust(width - 10)} │")
    
    attendance = game_data.get('gameInfo', {}).get('attendance', '')
    if attendance:
        card.append(f"│   Attendance: {attendance.ljust(width - 18)} │")
    
    card.append(f"└{'─' * (width - 2)}┘")
    
    return '\n'.join(card)
