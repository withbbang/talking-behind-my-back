import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import {
  THEME_COLOR,
  THEME_INIT_SCRIPT,
  THEME_KEY,
  applyTheme,
  readTheme,
  resolveTheme,
  ThemeSync,
  setTheme,
  useTheme,
} from './theme';

type Listener = (e: { matches: boolean }) => void;

/** jsdom 에 matchMedia 가 없다. prefers-color-scheme: dark 만 흉내내고 change 리스너를 잡아둔다. */
function mockMatchMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: 'change', l: Listener) => listeners.add(l),
    removeEventListener: (_: 'change', l: Listener) => listeners.delete(l),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    flip(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
    listeners,
  };
}

function metaContent() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('theme (T-020, D-024)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#fff4f8">';
  });
  afterEach(() => {
    setTheme('system');
  });

  describe('readTheme / resolveTheme', () => {
    it('저장 없음 → system, light/dark 저장값은 그대로, 이상한 값은 system', () => {
      expect(readTheme()).toBe('system');
      localStorage.setItem(THEME_KEY, 'dark');
      expect(readTheme()).toBe('dark');
      localStorage.setItem(THEME_KEY, 'light');
      expect(readTheme()).toBe('light');
      localStorage.setItem(THEME_KEY, 'neon');
      expect(readTheme()).toBe('system');
    });

    it('system 은 prefersDark 를 따르고, 고정값은 무시', () => {
      expect(resolveTheme('system', true)).toBe('dark');
      expect(resolveTheme('system', false)).toBe('light');
      expect(resolveTheme('light', true)).toBe('light');
      expect(resolveTheme('dark', false)).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    it('light/dark 는 <html data-theme> + theme-color 메타, system 은 속성 제거 + 시스템 색', () => {
      mockMatchMedia(true);
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(metaContent()).toBe(THEME_COLOR.light);

      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(metaContent()).toBe(THEME_COLOR.dark);

      applyTheme('system');
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
      expect(metaContent()).toBe(THEME_COLOR.dark); // 시스템이 다크
    });

    it('theme-color 메타가 없으면 만든다', () => {
      mockMatchMedia(false);
      document.head.innerHTML = '';
      applyTheme('dark');
      expect(metaContent()).toBe(THEME_COLOR.dark);
    });
  });

  describe('setTheme / useTheme', () => {
    it('setTheme 은 저장 + 적용, system 은 키를 지운다', () => {
      mockMatchMedia(false);
      setTheme('dark');
      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      setTheme('system');
      expect(localStorage.getItem(THEME_KEY)).toBeNull();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('useTheme 은 저장값으로 시작하고 setTheme 에 반응한다', () => {
      mockMatchMedia(false);
      localStorage.setItem(THEME_KEY, 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current[0]).toBe('light');
      act(() => result.current[1]('dark'));
      expect(result.current[0]).toBe('dark');
      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    });

    it('system 모드에서 OS 테마가 바뀌면 theme-color 메타만 따라간다(속성은 그대로 없음)', () => {
      const mm = mockMatchMedia(false);
      const { unmount } = renderHook(() => useTheme());
      act(() => setTheme('system'));
      expect(metaContent()).toBe(THEME_COLOR.light);
      act(() => mm.flip(true));
      expect(metaContent()).toBe(THEME_COLOR.dark);
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
      unmount();
      expect(mm.listeners.size).toBe(0);
    });

    it('고정 모드에선 OS 테마 변화를 무시한다', () => {
      const mm = mockMatchMedia(false);
      renderHook(() => useTheme());
      act(() => setTheme('light'));
      act(() => mm.flip(true));
      expect(metaContent()).toBe(THEME_COLOR.light);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('다른 탭의 storage 이벤트로도 갱신된다', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      expect(result.current[0]).toBe('system');
      localStorage.setItem(THEME_KEY, 'dark');
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark' }));
      });
      expect(result.current[0]).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('ThemeSync (루트 레이아웃)', () => {
    it('마운트 시 저장값으로 data-theme + theme-color 메타를 맞춘다(메타 없으면 생성)', () => {
      mockMatchMedia(false);
      document.head.innerHTML = '';
      localStorage.setItem(THEME_KEY, 'dark');
      render(<ThemeSync />);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(metaContent()).toBe(THEME_COLOR.dark);
    });
  });

  describe('THEME_INIT_SCRIPT (첫 페인트 전 인라인)', () => {
    const run = () => new Function(THEME_INIT_SCRIPT)();

    it('저장값 dark → data-theme=dark. 메타는 건드리지 않는다(hydration 전 변경 = 중복)', () => {
      mockMatchMedia(false);
      localStorage.setItem(THEME_KEY, 'dark');
      run();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(metaContent()).toBe('#fff4f8');
    });

    it('저장값 없음 → 속성 없음', () => {
      mockMatchMedia(true);
      run();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('localStorage 가 막혀 있어도 예외 없이 끝난다', () => {
      mockMatchMedia(false);
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(run).not.toThrow();
      spy.mockRestore();
    });
  });
});
