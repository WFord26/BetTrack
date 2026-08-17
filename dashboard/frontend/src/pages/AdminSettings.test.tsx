/**
 * Tests for AdminSettings page
 * Admin settings configuration page tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import AdminSettings from '@/pages/AdminSettings';

vi.mock('@/services/api', () => ({
  default: {
    getSettings: vi.fn(() => Promise.resolve({ data: {} })),
    updateSettings: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('AdminSettings Page', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<AdminSettings />);
    expect(container).toBeInTheDocument();
  });

  it('is a valid React component', () => {
    const element = <AdminSettings />;
    expect(element.type).toBeDefined();
  });

  it('exports as a function component', () => {
    expect(AdminSettings).toBeDefined();
    expect(typeof AdminSettings).toBe('function');
  });

  it('can be rendered with Redux provider', () => {
    const result = renderWithProviders(<AdminSettings />);
    expect(result.container.firstChild).toBeTruthy();
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
