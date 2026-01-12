import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodEffects } from 'zod';
import { logger } from '../config/logger';

/**
 * Middleware to validate request data against a Zod schema
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }));

        logger.warn(`Validation error: ${JSON.stringify(errors)}`);

        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware to validate only request body
 */
export const validateBody = (schema: AnyZodObject | ZodEffects<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }));

        logger.warn(`Body validation error: ${JSON.stringify(errors)}`);

        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware to validate only query parameters
 */
export const validateQuery = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }));

        logger.warn(`Query validation error: ${JSON.stringify(errors)}`);

        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware to validate only route parameters
 */
export const validateParams = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message
        }));

        logger.warn(`Params validation error: ${JSON.stringify(errors)}`);

        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors
        });
        return;
      }
      next(error);
    }
  };
};
