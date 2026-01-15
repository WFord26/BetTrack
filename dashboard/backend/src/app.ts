import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './config/logger';
import routes from './routes';

const app = express();

// Security & Performance Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'sports-betting-dashboard',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', routes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Error Handling
app.use(errorMiddleware);

export default app;
