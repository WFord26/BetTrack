/**
 * Jest test setup
 * Runs before all tests to configure the testing environment
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.ODDS_API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SESSION_SECRET = 'test-session-secret';

// NOTE: Prisma is NOT mocked here to allow integration tests to use real database
// Unit tests should mock Prisma within their own test files if needed

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global teardown
afterAll(async () => {
  // Clean up any resources
  jest.clearAllMocks();
});
