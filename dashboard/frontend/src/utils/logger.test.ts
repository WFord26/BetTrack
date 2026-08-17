/**
 * Tests for the frontend logger.
 *
 * The whole point of this module is that `debug`/`info` disappear from a
 * production build while `warn`/`error` never do. `isDev` is captured at module
 * load, so each mode is exercised by re-importing the module with
 * `import.meta.env.DEV` stubbed accordingly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadLogger(isDev: boolean) {
  vi.resetModules();
  vi.stubEnv('DEV', isDev);
  const { logger } = await import('./logger');
  return logger;
}

describe('logger', () => {
  let spies: Record<'debug' | 'log' | 'warn' | 'error', ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    spies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('in development', () => {
    it('forwards debug to console.debug with every argument', async () => {
      const logger = await loadLogger(true);

      logger.debug('fetching odds', { gameId: 'game-1' }, 42);

      expect(spies.debug).toHaveBeenCalledWith('fetching odds', { gameId: 'game-1' }, 42);
    });

    it('forwards info to console.log', async () => {
      const logger = await loadLogger(true);

      logger.info('slip submitted');

      expect(spies.log).toHaveBeenCalledWith('slip submitted');
    });
  });

  describe('in a production build', () => {
    it('drops debug entirely', async () => {
      const logger = await loadLogger(false);

      logger.debug('noisy diagnostic');

      expect(spies.debug).not.toHaveBeenCalled();
    });

    it('drops info entirely', async () => {
      const logger = await loadLogger(false);

      logger.info('noisy diagnostic');

      expect(spies.log).not.toHaveBeenCalled();
    });

    it('still emits warnings, which users and log scrapers rely on', async () => {
      const logger = await loadLogger(false);

      logger.warn('odds snapshot is stale', 620);

      expect(spies.warn).toHaveBeenCalledWith('odds snapshot is stale', 620);
    });

    it('still emits errors', async () => {
      const logger = await loadLogger(false);
      const failure = new Error('Request failed');

      logger.error('failed to load games:', failure);

      expect(spies.error).toHaveBeenCalledWith('failed to load games:', failure);
    });
  });

  it('returns undefined from every level, so no call site can depend on a value', async () => {
    const logger = await loadLogger(true);

    expect(logger.debug('x')).toBeUndefined();
    expect(logger.info('x')).toBeUndefined();
    expect(logger.warn('x')).toBeUndefined();
    expect(logger.error('x')).toBeUndefined();
  });
});
