import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

const base = {
  title: '나가면 이 방은 끝이야. 진짜 갈래?',
  confirmLabel: '나가기',
  onConfirm: () => {},
};

describe('ConfirmDialog (DESIGN.md 모달)', () => {
  it('open=false 면 렌더하지 않는다', () => {
    render(<ConfirmDialog open={false} {...base} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('제목으로 라벨된 모달, 주 버튼이 onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open {...base} onConfirm={onConfirm} body="여기 얘긴 못 봐" />);
    const dialog = screen.getByRole('dialog', { name: base.title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('여기 얘긴 못 봐')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelLabel 이 있으면 보조 버튼 + Escape 가 onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open {...base} cancelLabel="취소" onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('cancelLabel 없으면 버튼 1개 (닫기 X 없음)', () => {
    render(<ConfirmDialog open {...base} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('열리면 주 버튼에 포커스', () => {
    render(<ConfirmDialog open {...base} />);
    expect(screen.getByRole('button', { name: '나가기' })).toHaveFocus();
  });
});
