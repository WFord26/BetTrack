import { prisma } from '../config/database';

export interface GameMatchResult {
  game: any | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedTeam?: string;
}

/**
 * Fuzzy match game descriptions to actual games in the database
 * Matches by team names (home or away)
 */
export async function fuzzyMatchGames(gameDescriptions: string[]): Promise<GameMatchResult[]> {
  const now = new Date();

  // Fetch upcoming and in-progress games
  const games = await prisma.game.findMany({
    where: {
      commenceTime: {
        gte: now // Only future games
      },
      status: {
        notIn: ['final', 'completed']
      }
    },
    include: {
      sport: true
    },
    orderBy: {
      commenceTime: 'asc'
    },
    take: 500 // Limit for performance
  });

  // Match each description to a game
  return gameDescriptions.map(desc => {
    const descLower = desc.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = games.find(game => {
      const homeTeamLower = game.homeTeamName.toLowerCase();
      const awayTeamLower = game.awayTeamName.toLowerCase();
      
      return (
        (descLower.includes(homeTeamLower) && descLower.includes(awayTeamLower)) ||
        (descLower.includes(homeTeamLower.split(' ').pop() || '') && descLower.includes(awayTeamLower.split(' ').pop() || ''))
      );
    });

    if (exactMatch) {
      return {
        game: exactMatch,
        confidence: 'high' as const,
        matchedTeam: `${exactMatch.awayTeamName} @ ${exactMatch.homeTeamName}`
      };
    }

    // Try partial match on team names
    const partialMatch = games.find(game => {
      const homeTeamLower = game.homeTeamName.toLowerCase();
      const awayTeamLower = game.awayTeamName.toLowerCase();
      
      return (
        descLower.includes(homeTeamLower) ||
        descLower.includes(awayTeamLower)
      );
    });

    if (partialMatch) {
      const matchedTeam = descLower.includes(partialMatch.homeTeamName.toLowerCase())
        ? partialMatch.homeTeamName
        : partialMatch.awayTeamName;
      
      return {
        game: partialMatch,
        confidence: 'medium' as const,
        matchedTeam: `${partialMatch.awayTeamName} @ ${partialMatch.homeTeamName} (matched: ${matchedTeam})`
      };
    }

    // Try fuzzy match on keywords (Lakers, Warriors, Hurricanes, etc.)
    // Only use keywords >= 4 characters to avoid false matches
    const keywords = descLower.split(/\s+|vs|@|-/).filter(k => k.length >= 4);
    const fuzzyMatch = games.find(game => {
      const homeWords = game.homeTeamName.toLowerCase().split(/\s+/);
      const awayWords = game.awayTeamName.toLowerCase().split(/\s+/);
      
      return keywords.some(keyword => 
        homeWords.some(word => word.length >= 4 && (word.includes(keyword) || keyword.includes(word))) ||
        awayWords.some(word => word.length >= 4 && (word.includes(keyword) || keyword.includes(word)))
      );
    });

    if (fuzzyMatch) {
      return {
        game: fuzzyMatch,
        confidence: 'low' as const,
        matchedTeam: `${fuzzyMatch.awayTeamName} @ ${fuzzyMatch.homeTeamName} (fuzzy match)`
      };
    }

    // No match found
    return {
      game: null,
      confidence: 'none' as const
    };
  });
}

/**
 * Generate a user-friendly bet name from selections
 */
export function generateBetName(selections: any[]): string {
  if (selections.length === 1) {
    const sel = selections[0];
    return `${sel.teamName || 'Single'} ${sel.type}`;
  } else if (selections.length === 2) {
    return '2-Leg Parlay';
  } else if (selections.length === 3) {
    return '3-Leg Parlay';
  } else {
    return `${selections.length}-Leg Parlay`;
  }
}
