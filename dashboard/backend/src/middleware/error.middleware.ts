import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method}`);
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Unhandled errors
  logger.error(`500 - ${err.message} - ${req.originalUrl} - ${req.method}`);
  logger.error(err.stack);

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
};
