/**
 * Tests for EnhancedDashboard page
 * Main dashboard page component tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import EnhancedDashboard from '@/pages/EnhancedDashboard';

// Mock API calls to prevent CORS errors in test environment
vi.mock('@/services/api', () => ({
  default: {
    getGames: vi.fn(() => Promise.resolve({ data: [] })),
    getBets: vi.fn(() => Promise.resolve({ data: [] })),
    getStats: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('EnhancedDashboard Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<EnhancedDashboard />);
    expect(container).toBeInTheDocument();
  });

  it('returns a valid React element', () => {
    const element = <EnhancedDashboard />;
    expect(element.type).toBeDefined();
  });

  it('exports as a valid component', () => {
    expect(EnhancedDashboard).toBeDefined();
    expect(typeof EnhancedDashboard).toBe('function');
  });

  it('can be mounted with Redux provider', () => {
    const result = renderWithProviders(<EnhancedDashboard />);
    expect(result.container.firstChild).toBeTruthy();
  });
});

// Mock window.matchMedia for responsive design
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
