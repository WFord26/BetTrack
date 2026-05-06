/**
 * Tests for SportFilter component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SportFilter from './SportFilter';

describe('SportFilter', () => {
  it('renders all sport buttons', () => {
    render(<SportFilter value="all" onChange={vi.fn()} />);

    expect(screen.getByText('All Sports')).toBeInTheDocument();
    expect(screen.getByText('NBA')).toBeInTheDocument();
    expect(screen.getByText('NFL')).toBeInTheDocument();
    expect(screen.getByText('NHL')).toBeInTheDocument();
    expect(screen.getByText('MLB')).toBeInTheDocument();
    expect(screen.getByText('NCAAF')).toBeInTheDocument();
    expect(screen.getByText('NCAAB')).toBeInTheDocument();
  });

  it('highlights the active sport button', () => {
    const { container } = render(<SportFilter value="basketball_nba" onChange={vi.fn()} />);

    const nbaButton = screen.getByText('NBA');
    expect(nbaButton.className).toContain('bg-brand-600');
  });

  it('does not highlight inactive sport buttons', () => {
    render(<SportFilter value="basketball_nba" onChange={vi.fn()} />);

    const nflButton = screen.getByText('NFL');
    expect(nflButton.className).not.toContain('bg-brand-600');
  });

  it('calls onChange with correct sport key when a button is clicked', () => {
    const onChange = vi.fn();
    render(<SportFilter value="all" onChange={onChange} />);

    fireEvent.click(screen.getByText('NBA'));
    expect(onChange).toHaveBeenCalledWith('basketball_nba');
  });

  it('calls onChange with "all" when All Sports is clicked', () => {
    const onChange = vi.fn();
    render(<SportFilter value="basketball_nba" onChange={onChange} />);

    fireEvent.click(screen.getByText('All Sports'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('calls onChange with NHL sport key', () => {
    const onChange = vi.fn();
    render(<SportFilter value="all" onChange={onChange} />);

    fireEvent.click(screen.getByText('NHL'));
    expect(onChange).toHaveBeenCalledWith('icehockey_nhl');
  });
});
