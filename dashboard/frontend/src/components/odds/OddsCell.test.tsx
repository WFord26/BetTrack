/**
 * Tests for OddsCell component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OddsCell from './OddsCell';

describe('OddsCell', () => {
  it('renders formatted negative odds', () => {
    render(<OddsCell odds={-110} />);
    expect(screen.getByText('-110')).toBeInTheDocument();
  });

  it('renders formatted positive odds with + prefix', () => {
    render(<OddsCell odds={150} />);
    expect(screen.getByText('+150')).toBeInTheDocument();
  });

  it('renders spread line alongside odds', () => {
    render(<OddsCell odds={-110} line={-3.5} />);
    expect(screen.getByText('-3.5')).toBeInTheDocument();
    expect(screen.getByText('-110')).toBeInTheDocument();
  });

  it('renders total line with prefix', () => {
    render(<OddsCell odds={-110} line={220.5} prefix="O" />);
    expect(screen.getByText(/220.5/)).toBeInTheDocument();
  });

  it('applies selected styling when selected=true', () => {
    const { container } = render(<OddsCell odds={-110} selected={true} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('border-blue-600');
  });

  it('applies best styling when isBest=true and not selected', () => {
    const { container } = render(<OddsCell odds={-110} isBest={true} selected={false} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('text-green-600');
  });

  it('calls onClick handler when clicked', () => {
    const onClick = vi.fn();
    render(<OddsCell odds={-110} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<OddsCell odds={-110} onClick={onClick} disabled={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders decimal odds when useDecimalOdds=true', () => {
    render(<OddsCell odds={-110} useDecimalOdds={true} />);
    // -110 American = (100/110) + 1 ≈ 1.91 decimal
    expect(screen.getByText('1.91')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<OddsCell odds={-110} disabled={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
