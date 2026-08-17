/**
 * Tests for the Home page.
 *
 * Home is a static marketing page with no hooks besides `Link` and no
 * conditional branches — every element on it renders unconditionally from a
 * fixed const, so there's no state machine to exercise. What's worth
 * pinning down instead is the contract with the rest of the app: the CTA
 * routes to the real dashboard path, and the ticker duplicates its item list
 * for a seamless marquee loop (an easy thing to accidentally break) rather
 * than rendering it once.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

function renderPage() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe('Home page', () => {
  it('renders the headline and tagline', () => {
    renderPage();

    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline).toHaveTextContent('BET LIKE');
    expect(headline).toHaveTextContent('A COWBOY');
    expect(screen.getByText('Where the Wild West meets smart betting')).toBeInTheDocument();
  });

  it('links the primary CTA to the dashboard route', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'START TRACKING' })).toHaveAttribute('href', '/v2');
  });

  it('links "Learn More" to the in-page section anchor', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'LEARN MORE' })).toHaveAttribute(
      'href',
      '/#what-we-do'
    );
  });

  it('renders all three "what we are" feature cards', () => {
    renderPage();

    expect(screen.getByText('YOUR BETTING HQ')).toBeInTheDocument();
    expect(screen.getByText('REAL-TIME DATA')).toBeInTheDocument();
    expect(screen.getByText('AI-POWERED')).toBeInTheDocument();
  });

  it('duplicates the ticker items for a seamless marquee loop', () => {
    renderPage();

    expect(screen.getAllByText('LIVE ODDS · 7 SPORTS')).toHaveLength(2);
    expect(screen.getAllByText('AUTO BET SETTLEMENT')).toHaveLength(2);
  });
});
