/**
 * Tests for API service (axios configuration and URL resolution)
 *
 * Note: API_BASE_URL is resolved at module load time using import.meta.env,
 * so we test the static export directly rather than re-importing per-test.
 */

import { describe, it, expect } from 'vitest';
import apiClient, { API_BASE_URL, apiClient as namedApiClient } from './api';

describe('API Service', () => {
  describe('apiClient configuration', () => {
    it('exports a default axios instance', () => {
      expect(apiClient).toBeDefined();
      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
      expect(typeof apiClient.put).toBe('function');
      expect(typeof apiClient.delete).toBe('function');
    });

    it('has withCredentials=true for session cookie support', () => {
      expect(namedApiClient.defaults.withCredentials).toBe(true);
    });

    it('sets Content-Type to application/json', () => {
      expect(namedApiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('API_BASE_URL resolution', () => {
    it('resolves to a non-empty string', () => {
      expect(API_BASE_URL).toBeTruthy();
      expect(typeof API_BASE_URL).toBe('string');
    });

    it('contains /api in the URL', () => {
      expect(API_BASE_URL).toContain('/api');
    });

    it('does not have a trailing slash', () => {
      expect(API_BASE_URL).not.toMatch(/\/$/);
    });

    it('uses the VITE_API_URL stub set in test setup (localhost:3001/api)', () => {
      // setup.ts stubs VITE_API_URL to 'http://localhost:3001/api'
      expect(API_BASE_URL).toBe('http://localhost:3001/api');
    });
  });

  describe('URL normalization helpers (via API_BASE_URL behavior)', () => {
    it('does not double-append /api when env already ends with /api', () => {
      // The setup stub is 'http://localhost:3001/api' — verify no doubling
      expect(API_BASE_URL).not.toContain('/api/api');
    });
  });
});
