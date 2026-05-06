/**
 * Unit tests for Validation Middleware
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

jest.mock('../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { validate, validateBody, validateQuery } from '../src/middleware/validation.middleware';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

function mockResponse() {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe('validate middleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() when request data is valid', async () => {
    const schema = z.object({
      body: z.object({ name: z.string() }),
      query: z.object({}),
      params: z.object({}),
    });

    const { res } = mockResponse();
    const req = mockRequest({ body: { name: 'Test' } });

    await validate(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 400 when validation fails', async () => {
    const schema = z.object({
      body: z.object({ name: z.string().min(1) }),
      query: z.object({}),
      params: z.object({}),
    });

    const { res, status, json } = mockResponse();
    const req = mockRequest({ body: {} }); // Missing 'name'

    await validate(schema)(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('includes validation errors in response', async () => {
    const schema = z.object({
      body: z.object({ email: z.string().email() }),
      query: z.object({}),
      params: z.object({}),
    });

    const { res, json } = mockResponse();
    const req = mockRequest({ body: { email: 'not-an-email' } });

    await validate(schema)(req, res, next as NextFunction);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
        ]),
      })
    );
  });

  it('calls next(error) for non-ZodError', async () => {
    const schema = {
      parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
    } as unknown as z.AnyZodObject;

    const { res } = mockResponse();
    const req = mockRequest();

    await validate(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('validateBody middleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() and updates req.body when body is valid', async () => {
    const schema = z.object({ amount: z.number().positive() });
    const { res } = mockResponse();
    const req = mockRequest({ body: { amount: 100 } });

    await validateBody(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ amount: 100 });
  });

  it('returns 400 when body is invalid', async () => {
    const schema = z.object({ amount: z.number().positive() });
    const { res, status } = mockResponse();
    const req = mockRequest({ body: { amount: -50 } });

    await validateBody(schema)(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('coerces and transforms valid body data', async () => {
    const schema = z.object({ name: z.string().trim() });
    const { res } = mockResponse();
    const req = mockRequest({ body: { name: '  hello  ' } });

    await validateBody(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.name).toBe('hello');
  });
});

describe('validateQuery middleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() when query params are valid', async () => {
    const schema = z.object({ page: z.string().optional() });
    const { res } = mockResponse();
    const req = mockRequest({ query: { page: '1' } });

    await validateQuery(schema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 400 when query params are invalid', async () => {
    const schema = z.object({ status: z.enum(['active', 'inactive']) });
    const { res, status } = mockResponse();
    const req = mockRequest({ query: { status: 'invalid-value' } });

    await validateQuery(schema)(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
