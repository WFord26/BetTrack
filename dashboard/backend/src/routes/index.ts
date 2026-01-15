import { Router } from 'express';
import gamesRoutes from './games.routes';
import betsRoutes from './bets.routes';
import futuresRoutes from './futures.routes';
import mcpRoutes from './mcp.routes';
import adminRoutes from './admin.routes';
import apiKeysRoutes from './api-keys.routes';
import aiBetsRoutes from './ai-bets.routes';

const router = Router();

// Mount all routes
router.use('/games', gamesRoutes);
router.use('/bets', betsRoutes);
router.use('/futures', futuresRoutes);
router.use('/mcp', mcpRoutes);
router.use('/admin', adminRoutes);
router.use('/keys', apiKeysRoutes);
router.use('/ai/bets', aiBetsRoutes);

export default router;
