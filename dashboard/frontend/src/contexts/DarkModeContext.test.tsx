/**
 * Tests for DarkModeContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';

// Test component that consumes the context
function DarkModeConsumer() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  return (
    <div>
      <span data-testid="mode">{isDarkMode ? 'dark' : 'light'}</span>
      <button onClick={toggleDarkMode}>Toggle</button>
    </div>
  );
}

describe('DarkModeContext', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy directly on window.localStorage instance (not Storage.prototype).
    getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockReturnValue(null);
    setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {});
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    // Restore ONLY our spies — do NOT call vi.restoreAllMocks() here because
    // that also clears the vi.fn() matchMedia mock installed in setup.ts,
    // causing TypeError on subsequent tests that reach the fallback branch.
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light mode when no saved preference', () => {
    getItemSpy.mockReturnValue(null);

    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('loads saved dark mode preference from localStorage', () => {
    getItemSpy.mockImplementation((key: string) => key === 'darkMode' ? 'true' : null);

    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('loads saved light mode preference from localStorage', () => {
    getItemSpy.mockImplementation((key: string) => key === 'darkMode' ? 'false' : null);

    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('toggles dark mode on button click', () => {
    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('light');

    act(() => {
      fireEvent.click(screen.getByText('Toggle'));
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('adds "dark" class to documentElement when dark mode is on', () => {
    getItemSpy.mockImplementation((key: string) => key === 'darkMode' ? 'true' : null);

    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes "dark" class from documentElement when dark mode is off', () => {
    getItemSpy.mockImplementation((key: string) => key === 'darkMode' ? 'false' : null);

    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists toggled preference to localStorage', () => {
    render(
      <DarkModeProvider>
        <DarkModeConsumer />
      </DarkModeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Toggle'));
    });

    expect(setItemSpy).toHaveBeenCalledWith('darkMode', 'true');
  });

  it('throws when useDarkMode is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<DarkModeConsumer />);
    }).toThrow('useDarkMode must be used within a DarkModeProvider');

    spy.mockRestore();
  });
});
