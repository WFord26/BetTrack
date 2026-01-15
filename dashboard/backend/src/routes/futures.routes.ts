import { Router } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/futures
 * Get all active futures with current odds
 */
router.get('/', async (req, res) => {
  try {
    const { sportKey, status = 'active' } = req.query;

    const where: any = {
      status: status as string
    };

    if (sportKey) {
      const sport = await prisma.sport.findUnique({
        where: { key: sportKey as string },
        select: { id: true }
      });

      if (sport) {
        where.sportId = sport.id;
      }
    }

    const futures = await prisma.future.findMany({
      where,
      include: {
        sport: {
          select: {
            key: true,
            name: true
          }
        },
        currentOdds: {
          orderBy: {
            outcome: 'asc'
          }
        },
        outcomes: true
      },
      orderBy: {
        title: 'asc'
      }
    });

    // Group odds by outcome for easier frontend consumption
    const formattedFutures = futures.map(future => {
      // Group odds by outcome
      const outcomeGroups = new Map<string, Array<{ bookmaker: string; price: number }>>();
      
      future.currentOdds.forEach(odds => {
        if (!outcomeGroups.has(odds.outcome)) {
          outcomeGroups.set(odds.outcome, []);
        }
        outcomeGroups.get(odds.outcome)!.push({
          bookmaker: odds.bookmaker,
          price: odds.price
        });
      });

      const groupedOutcomes = Array.from(outcomeGroups.entries()).map(([outcome, bookmakers]) => ({
        outcome,
        bookmakers,
        bestOdds: Math.max(...bookmakers.map(b => b.price))
      }));

      return {
        ...future,
        groupedOutcomes
      };
    });

    res.json(formattedFutures);
  } catch (error) {
    logger.error('Error fetching futures:', error);
    res.status(500).json({ error: 'Failed to fetch futures' });
  }
});

/**
 * GET /api/futures/:id
 * Get a specific future with all odds and history
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const future = await prisma.future.findUnique({
      where: { id },
      include: {
        sport: {
          select: {
            key: true,
            name: true
          }
        },
        currentOdds: {
          orderBy: [
            { outcome: 'asc' },
            { price: 'desc' }
          ]
        },
        outcomes: true,
        oddsSnapshots: {
          orderBy: {
            capturedAt: 'desc'
          },
          take: 100 // Last 100 snapshots
        }
      }
    });

    if (!future) {
      return res.status(404).json({ error: 'Future not found' });
    }

    // Group odds by outcome
    const outcomeGroups = new Map<string, Array<{ bookmaker: string; price: number; lastUpdated: Date }>>();
    
    future.currentOdds.forEach(odds => {
      if (!outcomeGroups.has(odds.outcome)) {
        outcomeGroups.set(odds.outcome, []);
      }
      outcomeGroups.get(odds.outcome)!.push({
        bookmaker: odds.bookmaker,
        price: odds.price,
        lastUpdated: odds.lastUpdated
      });
    });

    const groupedOutcomes = Array.from(outcomeGroups.entries()).map(([outcome, bookmakers]) => ({
      outcome,
      bookmakers,
      bestOdds: Math.max(...bookmakers.map(b => b.price)),
      averageOdds: Math.round(bookmakers.reduce((sum, b) => sum + b.price, 0) / bookmakers.length)
    }));

    // Prepare line movement data (last 100 snapshots grouped by outcome)
    const lineMovement = new Map<string, Array<{ timestamp: Date; bookmaker: string; price: number }>>();
    
    future.oddsSnapshots.forEach(snapshot => {
      if (!lineMovement.has(snapshot.outcome)) {
        lineMovement.set(snapshot.outcome, []);
      }
      lineMovement.get(snapshot.outcome)!.push({
        timestamp: snapshot.capturedAt,
        bookmaker: snapshot.bookmaker,
        price: snapshot.price
      });
    });

    res.json({
      ...future,
      groupedOutcomes,
      lineMovement: Object.fromEntries(lineMovement)
    });
  } catch (error) {
    logger.error('Error fetching future:', error);
    res.status(500).json({ error: 'Failed to fetch future' });
  }
});

export default router;
