import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { THEME_KEY, setTheme } from '@/lib/theme';
import { ThemePicker } from './ThemePicker';

describe('ThemePicker (DESIGN.md#2 사이드바 하단, D-024)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    setTheme('system');
  });

  it('필 토글 3칸 "시스템 | 라이트 | 다크", 기본 시스템 활성', () => {
    render(<ThemePicker />);
    const group = screen.getByRole('radiogroup', { name: '테마 선택' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['시스템', '라이트', '다크']);
    expect(screen.getByRole('radio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true');
  });

  it('칸을 누르면 저장 + <html data-theme> 반영', () => {
    render(<ThemePicker />);
    fireEvent.click(screen.getByRole('radio', { name: '다크' }));
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('radio', { name: '시스템' }));
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('저장된 값으로 시작한다', () => {
    localStorage.setItem(THEME_KEY, 'light');
    render(<ThemePicker />);
    expect(screen.getByRole('radio', { name: '라이트' })).toHaveAttribute('aria-checked', 'true');
  });
});
