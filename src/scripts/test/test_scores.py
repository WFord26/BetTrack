import asyncio
import json
from sports_api.espn_api_handler import ESPNAPIHandler

async def check_detailed_scores():
    handler = ESPNAPIHandler()
    
    # Check NBA for quarter scores
    print("=== NBA GAME DATA ===")
    result = await handler.get_scoreboard('basketball', 'nba', limit=5)
    if result.get('success'):
        events = result['data'].get('events', [])
        for event in events:
            comp = event['competitions'][0]
            status = comp['status']['type']
            if status['state'] in ['in', 'post']:
                print(f"\nGame: {event['name']}")
                print(f"Status: {status['description']}")
                competitors = comp['competitors']
                for c in competitors:
                    team = c['team']['displayName']
                    score = c.get('score', 0)
                    print(f"{team}: {score}")
                    if 'linescores' in c:
                        print(f"  Quarters: {c['linescores']}")
                print()
                break
    
    # Check NFL for weather
    print("\n=== NFL GAME DATA ===")
    result = await handler.get_scoreboard('football', 'nfl', limit=5)
    if result.get('success'):
        events = result['data'].get('events', [])
        for event in events:
            comp = event['competitions'][0]
            print(f"\nGame: {event['name']}")
            
            if 'weather' in comp:
                print("Weather data found:")
                print(json.dumps(comp['weather'], indent=2))
            else:
                print("No weather data")
            
            # Check venue for outdoor stadium info
            venue = comp.get('venue', {})
            print(f"Venue: {venue.get('fullName', 'Unknown')}")
            print(f"Indoor: {venue.get('indoor', False)}")
            break

asyncio.run(check_detailed_scores())
