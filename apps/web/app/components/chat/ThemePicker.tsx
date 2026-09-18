'use client';

import { PillToggle } from '@/components/ui/PillToggle';
import { type Theme, useTheme } from '@/lib/theme';

const OPTIONS = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
] as const satisfies readonly { value: Theme; label: string }[];

/**
 * 테마 선택 (설정 시트 "테마" 줄, D-024 → D-034 7 위치 이동). 필 토글 3칸.
 * 라벨은 고정 용어(BRAND.md#5) — 개구쟁이 카피 적용 안 함.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return <PillToggle aria-label="테마 선택" options={OPTIONS} value={theme} onChange={setTheme} />;
}

/** 설정 시트 한 줄: 좌 "테마" 제목 + 우 필 토글. 방 안 설정 시트(모드 다음 줄)와 방 밖 설정 시트가 같은 줄을 쓴다. */
export function ThemeRow() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[15px] font-semibold">테마</h3>
      <ThemePicker />
    </div>
  );
}
