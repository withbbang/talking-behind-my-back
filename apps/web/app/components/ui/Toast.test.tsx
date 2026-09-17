import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Toast, ToastHost, useToastStore } from './Toast';

describe('Toast (DESIGN.md 토스트, D-020 스펙 통일)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toast: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('message 가 null 이면 아무것도 렌더하지 않는다', () => {
    render(<Toast message={null} onClose={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('기본 3초 뒤 onClose, 닫기 버튼은 없다', () => {
    const onClose = vi.fn();
    render(<Toast message="복사 완료" onClose={onClose} />);

    expect(screen.getByRole('alert')).toHaveTextContent('복사 완료');
    expect(screen.queryByRole('button')).toBeNull();
    act(() => vi.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('스토어 show → ToastHost 가 알림을 띄우고 3초 뒤 지운다', () => {
    render(<ToastHost />);
    act(() => useToastStore.getState().show('아직 답 쓰는 중. 좀만 기다려줘!', 'error'));
    expect(screen.getByRole('alert')).toHaveTextContent('아직 답 쓰는 중');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('연속 show 는 마지막 메시지로 교체', () => {
    render(<ToastHost />);
    act(() => useToastStore.getState().show('첫째'));
    act(() => useToastStore.getState().show('둘째'));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('둘째');
  });
});
