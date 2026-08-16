/**
 * Frontend logger
 *
 * The browser has no Winston equivalent, so this is a thin, level-aware wrapper
 * around the console. Its purpose is to give call sites a single, greppable
 * logging entry point and to keep diagnostic chatter out of production builds.
 *
 * - `debug` / `info` are development-only; they are no-ops in a production build.
 * - `warn` / `error` always emit, so real problems stay visible to users' devtools
 *   and to anything that scrapes the console.
 *
 * This module is the only place in `src/` allowed to touch `console` directly
 * (see the `no-console` allowlist in eslint.config.js).
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.debug(...args);
    }
  },

  info: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },

  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  error: (...args: unknown[]): void => {
    console.error(...args);
  }
};
