import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisualViewportVars } from './useVisualViewport';

/** 테스트용 visualViewport — iOS 는 키보드가 뜨면 layout 높이(100dvh)는 그대로, visual viewport 만 줄고 offsetTop 만큼 팬된다. */
class FakeVV extends EventTarget {
  height = 874;
  offsetTop = 0;
}

describe('useVisualViewportVars (T-050 iOS 키보드)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--vvh');
    document.documentElement.style.removeProperty('--vvt');
  });

  it('보이는 영역 높이·오프셋을 --vvh/--vvt 로 내리고 resize·scroll 마다 갱신, 언마운트 시 제거', () => {
    const vv = new FakeVV();
    vi.stubGlobal('visualViewport', vv);
    const { unmount } = renderHook(() => useVisualViewportVars());
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--vvh')).toBe('874px');
    expect(style.getPropertyValue('--vvt')).toBe('0px');

    vv.height = 488; // 키보드
    vv.offsetTop = 300; // iOS 가 입력창을 보이려고 팬
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(style.getPropertyValue('--vvh')).toBe('488px');
    act(() => {
      vv.dispatchEvent(new Event('scroll'));
    });
    expect(style.getPropertyValue('--vvt')).toBe('300px');

    unmount();
    expect(style.getPropertyValue('--vvh')).toBe('');
    expect(style.getPropertyValue('--vvt')).toBe('');
  });

  it('visualViewport 가 없으면(구형·SSR) 아무것도 안 한다 — CSS 폴백 100dvh', () => {
    vi.stubGlobal('visualViewport', undefined);
    renderHook(() => useVisualViewportVars());
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('');
  });
});
