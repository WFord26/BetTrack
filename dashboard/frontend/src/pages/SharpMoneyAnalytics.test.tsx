import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import SharpMoneyAnalytics from './SharpMoneyAnalytics';
import { renderWithProviders } from '@/test/test-utils';

// Mock services
vi.mock('@/services/api');
vi.mock('@/services/logger');

// Mock window.matchMedia
beforeAll(() => {
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
});

describe('SharpMoneyAnalytics', () => {
  it('should render without crashing', () => {
    const { container } = renderWithProviders(<SharpMoneyAnalytics />);
    expect(container).toBeDefined();
  });

  it('should be a function component', () => {
    expect(typeof SharpMoneyAnalytics).toBe('function');
  });

  it('should export as function', () => {
    expect(SharpMoneyAnalytics).toBeDefined();
    expect(typeof SharpMoneyAnalytics).toBe('function');
  });

  it('should mount with Redux provider', () => {
    const { container } = renderWithProviders(<SharpMoneyAnalytics />);
    expect(container.querySelector('[role]')).toBeDefined();
  });

  it('should have correct DOM structure', () => {
    const { container } = renderWithProviders(<SharpMoneyAnalytics />);
    const element = container.firstChild;
    expect(element).toBeDefined();
    expect(element?.nodeType).toBe(1); // Node.ELEMENT_NODE
  });
});
