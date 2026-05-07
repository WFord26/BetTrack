import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { initializeSessionStore, shutdownSessionStore } from './services/session-store.service';
import { startOddsSyncJob } from './jobs/sync-odds.job';
import { startSettleBetsJob } from './jobs/settle-bets.job';
import { startStatsSyncJob } from './jobs/stats-sync.job';
import { startClosingLineCaptureJob } from './jobs/capture-closing-lines.job';
import { initializeCleanupJob } from './jobs/cleanup-old-records.job';

const PORT = parseInt(env.PORT, 10);

// Initialize session store before starting server
async function startServer() {
  try {
    await initializeSessionStore();
  } catch (error) {
    logger.error('Failed to initialize session store:', error);
    // Continue anyway - in-memory store will be used as fallback
  }

  // Start Server
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Environment: ${env.NODE_ENV}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    logger.info(`🎯 API endpoint: http://localhost:${PORT}/api`);

    // Start scheduled jobs
    try {
      startOddsSyncJob();
      startSettleBetsJob();
      startStatsSyncJob();
      startClosingLineCaptureJob();
      initializeCleanupJob();
      logger.info('✅ Scheduled jobs started');
    } catch (error) {
      logger.error('Failed to start scheduled jobs:', error);
    }
  });

  // Graceful Shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close session store
        await shutdownSessionStore();
        logger.info('Session store closed');

        // Close database connection
        await prisma.$disconnect();
        logger.info('Database connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });

  return server;
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

