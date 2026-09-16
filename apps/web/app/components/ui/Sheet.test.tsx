import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';

describe('Sheet (DESIGN.md 바텀 시트)', () => {
  it('open=false 면 렌더 없음', () => {
    render(
      <Sheet open={false} onClose={() => {}} label="방 정보">
        내용
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('dialog aria-modal + 라벨, Escape 와 딤 클릭으로 onClose', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} label="방 정보">
        내용
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: '방 정보' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('내용')).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-dim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
