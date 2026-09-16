'use client';

import { PillToggle } from '@/components/ui/PillToggle';
import { type Theme, useTheme } from '@/lib/theme';

const OPTIONS = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
] as const satisfies readonly { value: Theme; label: string }[];

/**
 * 테마 선택 (DESIGN.md#2 사이드바 하단, D-024). 필 토글 3칸, 보조 라벨 없음.
 * 라벨은 고정 용어(BRAND.md#5) — 개구쟁이 카피 적용 안 함.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return <PillToggle aria-label="테마 선택" options={OPTIONS} value={theme} onChange={setTheme} />;
}
