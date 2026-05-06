import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import compression from 'compression';
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './config/logger';
import { attachAuthSession } from './middleware/auth-session.middleware';
import routes from './routes';

const app = express();
const allowedOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// SECURITY: With `credentials: true`, allowing all origins is a CSRF risk.
// Fail closed in production when CORS_ORIGIN is unset; in non-production,
// fall back to permissive (and warn loudly) to keep local dev workflows
// — Vite, Storybook, etc. — working without ceremony.
if (allowedOrigins.length === 0) {
  if (env.NODE_ENV === 'production') {
    logger.error('❌ CORS_ORIGIN is not set in production — refusing to start with an open CORS policy.');
    throw new Error('CORS_ORIGIN must be configured in production');
  }
  logger.warn('⚠️  CORS_ORIGIN not set — allowing all origins (development only, NOT PRODUCTION SAFE).');
}

// Security & Performance Middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Same-origin / non-browser requests (no Origin header) are always allowed.
    if (!origin) {
      callback(null, true);
      return;
    }

    // Dev fallback: when no allow-list is configured we already warned above.
    if (allowedOrigins.length === 0 && env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(attachAuthSession);

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
