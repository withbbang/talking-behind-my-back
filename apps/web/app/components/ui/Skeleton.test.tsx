import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('role=status + sr-only 라벨, lines 개수만큼 막대', () => {
    const { container } = render(<Skeleton lines={3} label="방 목록 불러오는 중" />);
    expect(screen.getByRole('status')).toHaveTextContent('방 목록 불러오는 중');
    expect(container.querySelectorAll('[data-skeleton-line]')).toHaveLength(3);
  });
});
