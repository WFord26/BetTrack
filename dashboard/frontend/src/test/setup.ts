/**
 * Test setup file for Vitest
 * Configures the testing environment with necessary polyfills and matchers
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:3001/api');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

/**
 * ResizeObserver polyfill for Recharts.
 *
 * jsdom has no layout engine, so `ResponsiveContainer` never learns a size and
 * renders nothing — which silently blanks every chart-bearing page under test.
 * This stand-in reports a fixed viewport as soon as an element is observed, so
 * charts mount and their series actually render.
 */
const OBSERVED_WIDTH = 1024;
const OBSERVED_HEIGHT = 768;

global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const contentRect = {
      width: OBSERVED_WIDTH,
      height: OBSERVED_HEIGHT,
      top: 0,
      left: 0,
      bottom: OBSERVED_HEIGHT,
      right: OBSERVED_WIDTH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    this.callback(
      [{ target, contentRect } as unknown as ResizeObserverEntry],
      this as unknown as globalThis.ResizeObserver
    );
  }

  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof globalThis.ResizeObserver;

// Recharts also reads the element box directly; jsdom always reports zero.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: OBSERVED_WIDTH,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: OBSERVED_HEIGHT,
});

/**
 * In-memory Storage stand-in.
 *
 * These are real implementations rather than bare `vi.fn()` stubs: code under
 * test that writes a value and reads it back (preferences, arbitrage alert
 * settings, the auth token) has to observe the value it actually wrote,
 * otherwise the persistence branch is exercised but never verified. Methods are
 * own properties of the object so `vi.spyOn(window.localStorage, 'getItem')`
 * still works for tests that want to force a specific value or a throw.
 */
function createStorageMock(): Storage {
  let store: Record<string, string> = {};

  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = String(value);
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
    get length(): number {
      return Object.keys(store).length;
    },
  } as Storage;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

global.localStorage = localStorageMock;
global.sessionStorage = sessionStorageMock;

// Each test file starts from a clean slate; stale keys between tests would
// otherwise make persistence assertions order-dependent.
afterEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});
