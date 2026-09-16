/**
 * 테마 상수 + 첫 페인트 전 인라인 스크립트 (T-020, D-024).
 * 'use client' 없음 — app/layout.tsx(서버 컴포넌트)가 문자열로 import 해야 한다. 훅·DOM 로직은 lib/theme.ts.
 */
export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<Theme, 'system'>;

export const THEME_KEY = 'theme';
/** globals.css `--bg` 라이트/다크와 같은 값 (BRAND.md#2). */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#fff4f8', dark: '#170611' };
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * <head> 에서 hydration 전에 실행할 인라인 스크립트 — <html data-theme> 만 세팅한다.
 * <meta name="theme-color"> 는 여기서 건드리지 않는다: hydration 전에 content 를 바꾸면 React 19 가 hoistable 을 못 맞춰
 * 새 meta 를 하나 더 꽂는다(실측, 중복). 메타 동기화는 hydration 뒤 ThemeSync(lib/theme.ts) 가 한다.
 * try/catch 로 감싸 localStorage 접근 불가에도 페이지가 죽지 않는다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`;
