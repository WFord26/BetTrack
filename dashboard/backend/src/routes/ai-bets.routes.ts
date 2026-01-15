import express from 'express';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { prisma } from '../config/database';

// Simple logger
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
};

const router = express.Router();

interface AiBetSelection {
  gameId: string;  // Use game ID directly instead of index
  type: 'moneyline' | 'spread' | 'total';
  selection: 'home' | 'away' | 'over' | 'under';
  odds: number;
  line?: number;
  teamName?: string;
}

interface AiBetRequest {
  selections: AiBetSelection[];  // Each selection has its own gameId
  betType: 'single' | 'parlay' | 'teaser';
  stake: number;
  teaserPoints?: number;
  notes?: string;
  source?: 'mcp' | 'image' | 'text' | 'conversation';
}

/**
 * POST /api/ai/bets
 * Create a bet from AI-extracted data using game IDs
 */
router.post('/', apiKeyAuth, async (req, res) => {
  try {
    const {
      selections,
      betType,
      stake,
      teaserPoints,
      notes,
      source = 'mcp'
    } = req.body as AiBetRequest;

    // Validate request
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'selections array is required'
      });
    }

    if (!betType || !['single', 'parlay', 'teaser'].includes(betType)) {
      return res.status(400).json({
        success: false,
        error: 'betType must be single, parlay, or teaser'
      });
    }

    if (!stake || stake <= 0) {
      return res.status(400).json({
        success: false,
        error: 'stake must be a positive number'
      });
    }

    // Validate all selections have required fields including odds
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i];
      if (!sel.gameId) {
        return res.status(400).json({
          success: false,
          error: `Selection ${i + 1} missing gameId`
        });
      }
      if (!sel.type || !['moneyline', 'spread', 'total'].includes(sel.type)) {
        return res.status(400).json({
          success: false,
          error: `Selection ${i + 1} must have type: moneyline, spread, or total`
        });
      }
      if (!sel.selection || !['home', 'away', 'over', 'under'].includes(sel.selection)) {
        return res.status(400).json({
          success: false,
          error: `Selection ${i + 1} must have selection: home, away, over, or under`
        });
      }
      if (sel.odds === undefined || sel.odds === null) {
        return res.status(400).json({
          success: false,
          error: `Selection ${i + 1} missing required odds value`
        });
      }
      // Validate line is present for spread/total bets
      if ((sel.type === 'spread' || sel.type === 'total') && (sel.line === undefined || sel.line === null)) {
        return res.status(400).json({
          success: false,
          error: `Selection ${i + 1} (${sel.type}) requires a line value`
        });
      }
    }

    // Validate all game IDs exist
    const gameIds = selections.map(s => s.gameId);
    const uniqueGameIds = [...new Set(gameIds)];
    
    logger.info(`AI bet request: Validating ${uniqueGameIds.length} game IDs`);
    
    const games = await prisma.game.findMany({
      where: {
        id: {
          in: uniqueGameIds
        }
      },
      include: {
        sport: true
      }
    });

    if (games.length !== uniqueGameIds.length) {
      const foundIds = games.map(g => g.id);
      const missingIds = uniqueGameIds.filter(id => !foundIds.includes(id));
      
      return res.status(400).json({
        success: false,
        error: 'Some game IDs not found',
        details: {
          requestedGames: uniqueGameIds.length,
          foundGames: games.length,
          missingGameIds: missingIds
        }
      });
    }

    // Detect Same Game Parlays (SGP) - group selections by game
    const gameGroups = new Map<string, typeof selections>();
    selections.forEach(sel => {
      if (!gameGroups.has(sel.gameId)) {
        gameGroups.set(sel.gameId, []);
      }
      gameGroups.get(sel.gameId)!.push(sel);
    });

    // For SGP games (multiple legs on same game), multiply all legs' odds
    const sgpGames = new Set<string>();
    const effectiveOdds: number[] = [];
    
    gameGroups.forEach((gameSelections, gameId) => {
      if (gameSelections.length > 1) {
        // Same Game Parlay detected - add all legs' odds (sportsbooks multiply them)
        sgpGames.add(gameId);
        gameSelections.forEach(sel => effectiveOdds.push(sel.odds));
        const oddsDisplay = gameSelections.map(s => s.odds).join(', ');
        logger.info(`SGP detected on game ${gameId}: ${gameSelections.length} legs, odds: ${oddsDisplay}`);
      } else {
        // Regular single leg on this game
        effectiveOdds.push(gameSelections[0].odds);
      }
    });

    // Build bet legs with SGP group IDs
    const legs = selections.map(sel => {
      const isSGP = sgpGames.has(sel.gameId);
      return {
        gameId: sel.gameId,
        selectionType: sel.type,
        selection: sel.selection,
        odds: sel.odds,
        line: sel.line || null,
        sgpGroupId: isSGP ? sel.gameId : null  // Use gameId as group ID for SGP legs
      };
    });

    // Generate bet name from selections or use notes
    const name = notes?.split('\n')[0] || `${betType.toUpperCase()} bet - ${selections.length} leg${selections.length > 1 ? 's' : ''}`;

    // Calculate potential payout using effective odds (SGP-aware)
    let potentialPayout: number;
    let oddsAtPlacement: number | null = null;
    
    if (betType === 'single') {
      const odds = selections[0].odds;
      oddsAtPlacement = odds;
      potentialPayout = odds > 0 
        ? stake * (odds / 100)
        : stake * (100 / Math.abs(odds));
    } else {
      // Parlay calculation using effective odds (accounts for SGP groups)
      const decimalOdds = effectiveOdds.map(odd => 
        odd > 0 ? 1 + (odd / 100) : 1 + (100 / Math.abs(odd))
      );
      const totalDecimalOdds = decimalOdds.reduce((acc, odd) => acc * odd, 1);
      
      // Convert back to American odds for storage
      if (totalDecimalOdds >= 2.0) {
        oddsAtPlacement = Math.round((totalDecimalOdds - 1) * 100);
      } else {
        oddsAtPlacement = Math.round(-100 / (totalDecimalOdds - 1));
      }
      
      potentialPayout = stake * totalDecimalOdds;
      
      logger.info(`Parlay odds calculation: ${effectiveOdds.join(', ')} → ${oddsAtPlacement} (${gameGroups.size} games, ${sgpGames.size} with SGP)`);
    }

    // Create bet in database
    const bet = await prisma.bet.create({
      data: {
        name,
        betType,
        stake,
        potentialPayout,
        oddsAtPlacement,
        teaserPoints: teaserPoints || null,
        notes: `Created by AI${source ? ` from ${source}` : ''}\n${notes || ''}`,
        status: 'pending',
        legs: {
          create: legs
        }
      },
      include: {
        legs: {
          include: {
            game: {
              include: {
                sport: true
              }
            }
          }
        }
      }
    });

    logger.info(`AI bet created: ${bet.id} (${betType}, ${legs.length} legs, $${stake})`);

    res.json({
      success: true,
      bet,
      message: 'Bet created successfully'
    });

  } catch (error: any) {
    logger.error('Error creating AI bet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bet',
      details: error.message
    });
  }
});

export default router;
