/**
 * Tests for Login page
 * Authentication surface tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import Login from '@/pages/Login';

// Mock auth service to prevent actual authentication attempts
vi.mock('@/services/auth', () => ({
  login: vi.fn(() => Promise.resolve({ token: 'mock-token' })),
  logout: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Login Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<Login />);
    expect(container).toBeInTheDocument();
  });

  it('returns a valid React component', () => {
    const element = <Login />;
    expect(element.type).toBeDefined();
  });

  it('exports as a function component', () => {
    expect(Login).toBeDefined();
    expect(typeof Login).toBe('function');
  });

  it('can be mounted with Redux provider', () => {
    const result = renderWithProviders(<Login />);
    expect(result.container.firstChild).toBeTruthy();
  });

  it('has displayName or name property', () => {
    expect(Login.name || (Login as { displayName?: string }).displayName).toBeDefined();
  });
});

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
