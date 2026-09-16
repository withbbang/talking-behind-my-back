'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * 테마 수동 선택 (T-020, D-024).
 * - 저장: localStorage["theme"] = "light" | "dark". 시스템 추종은 키 없음.
 * - 적용: <html data-theme="light|dark"> (system 은 속성 제거 → globals.css 가 prefers-color-scheme 로 결정).
 * - <meta name="theme-color"> 는 실제 적용된 모드의 --bg 색으로 동기화 (iOS 상태바·PWA 타이틀바).
 * - 첫 페인트 전 data-theme 부착은 lib/themeInit.ts THEME_INIT_SCRIPT (app/layout.tsx <head>). 메타는 hydration 뒤 <ThemeSync/> 가 맞춘다.
 */
import { DARK_QUERY, THEME_COLOR, THEME_KEY, type ResolvedTheme, type Theme } from './themeInit';

export { DARK_QUERY, THEME_COLOR, THEME_INIT_SCRIPT, THEME_KEY } from './themeInit';
export type { ResolvedTheme, Theme } from './themeInit';

function isTheme(v: unknown): v is ResolvedTheme {
  return v === 'light' || v === 'dark';
}

/** localStorage 에서 읽는다. 없거나 이상한 값·접근 불가는 system. */
export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

function syncMeta(resolved: ResolvedTheme) {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[resolved];
}

/** DOM 에 적용만 한다(저장 안 함). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  syncMeta(resolveTheme(theme, systemPrefersDark()));
}

// --- 외부 스토어 (useSyncExternalStore) ---
// 스냅샷은 매번 localStorage 를 읽는다(문자열이라 값 동일성으로 안정). 저장이 막힌 환경만 메모리 값으로 대신한다.
let memoryFallback: Theme | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  return memoryFallback ?? readTheme();
}
function getServerSnapshot(): Theme {
  return 'system';
}
function emit() {
  listeners.forEach((l) => l());
}

/** 저장 + 적용 + 구독자 알림. */
export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
    memoryFallback = null;
  } catch {
    memoryFallback = theme; // 저장 불가(프라이빗 모드 등)여도 이번 세션엔 적용
  }
  if (typeof document !== 'undefined') applyTheme(theme);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * [theme, setTheme]. 마운트 중엔 (1) OS 테마 변화 시 system 모드면 theme-color 메타 재동기화,
 * (2) 다른 탭의 storage 이벤트를 반영한다.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (getSnapshot() === 'system') applyTheme('system');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== THEME_KEY) return;
      applyTheme(getSnapshot());
      emit();
    };
    mql.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const set = useCallback((t: Theme) => setTheme(t), []);
  return [theme, set];
}

/**
 * 루트 레이아웃에 1개. 마운트 시 저장값을 다시 적용해 theme-color 메타를 맞추고(hydration 전엔 못 건드림),
 * useTheme 의 OS 테마·storage 리스너를 사이드바 없는 화면(로그인·입장)에서도 살린다. 렌더 결과 없음.
 */
export function ThemeSync() {
  useTheme();
  useEffect(() => {
    applyTheme(getSnapshot());
  }, []);
  return null;
}
