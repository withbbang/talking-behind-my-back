import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge (DESIGN.md 필 배지)', () => {
  it('owner 는 "주인"', () => {
    render(<Badge kind="owner" />);
    expect(screen.getByText('주인')).toBeInTheDocument();
  });
  it('closed 는 "닫힘"', () => {
    render(<Badge kind="closed" />);
    expect(screen.getByText('닫힘')).toBeInTheDocument();
  });
});
