import { describe, it, expect, jest } from '@jest/globals';
import { asyncHandler } from '../src/utils/async-handler';
import { Request, Response, NextFunction } from 'express';

describe('asyncHandler', () => {
  it('calls the wrapped handler with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await asyncHandler(fn)(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it('passes thrown errors to next()', async () => {
    const error = new Error('boom');
    const fn = jest.fn().mockRejectedValue(error);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await asyncHandler(fn)(req, res, next);
    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next() when the handler resolves successfully', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await asyncHandler(fn)(req, res, next);
    await new Promise(process.nextTick);

    expect(next).not.toHaveBeenCalled();
  });
});
