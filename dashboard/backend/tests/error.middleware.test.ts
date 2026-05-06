/**
 * Unit tests for Error Middleware
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock logger before imports
jest.mock('../src/config/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { errorMiddleware, AppError } from '../src/middleware/error.middleware';
import { logger } from '../src/config/logger';

const mockLogger = logger as jest.Mocked<typeof logger>;

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    originalUrl: '/api/test',
    method: 'GET',
    ...overrides,
  } as Request;
}

function mockResponse(): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

const mockNext: NextFunction = jest.fn() as unknown as NextFunction;

describe('AppError', () => {
  it('creates an error with custom status code', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });

  it('defaults to status 500 when no status code provided', () => {
    const err = new AppError('Internal error');
    expect(err.statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    const err = new AppError('Test error', 400);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('errorMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles AppError with correct status code and message', () => {
    const { res, status, json } = mockResponse();
    const err = new AppError('Resource not found', 404);

    errorMiddleware(err, mockRequest(), res, mockNext);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Resource not found',
    });
  });

  it('logs AppError with status code, message, url, and method', () => {
    const { res } = mockResponse();
    const err = new AppError('Bad request', 400);

    errorMiddleware(err, mockRequest({ originalUrl: '/api/bets', method: 'POST' }), res, mockNext);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('400')
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bad request')
    );
  });

  it('handles non-AppError with 500 status code', () => {
    const { res, status, json } = mockResponse();
    const err = new Error('Unexpected failure');

    errorMiddleware(err, mockRequest(), res, mockNext);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal server error',
    });
  });

  it('logs stack trace for unhandled errors', () => {
    const { res } = mockResponse();
    const err = new Error('Unhandled error');

    errorMiddleware(err, mockRequest(), res, mockNext);

    expect(mockLogger.error).toHaveBeenCalledTimes(2);
  });

  it('handles 401 Unauthorized AppError', () => {
    const { res, status } = mockResponse();
    const err = new AppError('Unauthorized', 401);

    errorMiddleware(err, mockRequest(), res, mockNext);

    expect(status).toHaveBeenCalledWith(401);
  });

  it('handles 403 Forbidden AppError', () => {
    const { res, status } = mockResponse();
    const err = new AppError('Forbidden', 403);

    errorMiddleware(err, mockRequest(), res, mockNext);

    expect(status).toHaveBeenCalledWith(403);
  });
});
