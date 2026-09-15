import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('message 가 null 이면 아무것도 렌더하지 않는다', () => {
    render(<Toast message={null} onClose={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('message 를 role=alert 로 보여주고 duration 뒤 onClose 를 부른다', () => {
    const onClose = vi.fn();
    render(<Toast message="로그인에 실패했어요." onClose={onClose} duration={3000} />);

    expect(screen.getByRole('alert')).toHaveTextContent('로그인에 실패했어요.');
    act(() => vi.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼으로 즉시 onClose', () => {
    const onClose = vi.fn();
    render(<Toast message="x" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
