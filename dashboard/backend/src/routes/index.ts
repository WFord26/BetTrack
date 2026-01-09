import { Router } from 'express';
import gamesRoutes from './games.routes';
import betsRoutes from './bets.routes';
import mcpRoutes from './mcp.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Mount all routes
router.use('/games', gamesRoutes);
router.use('/bets', betsRoutes);
router.use('/mcp', mcpRoutes);
router.use('/admin', adminRoutes);

export default router;
