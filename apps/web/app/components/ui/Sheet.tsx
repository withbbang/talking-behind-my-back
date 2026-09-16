'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; onClose: () => void; label: string; children: ReactNode };

/**
 * 바텀 시트 (DESIGN.md 공통 컴포넌트). 모바일: 하단에서 올라옴, 상단 라운드 28, 드래그 핸들 36×4.
 * 데스크톱(≥1024): 중앙 다이얼로그 360. 딤 클릭·Escape 로 닫힘. 그림자 없음 — 딤이 층을 만든다.
 */
export function Sheet({ open, onClose, label, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center">
      <div data-testid="sheet-dim" aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="bubble-in relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] bg-bg px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink outline-none lg:max-w-[360px] lg:rounded-[28px] lg:pb-6"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-9 rounded-full bg-ink/20 lg:hidden" />
        {children}
      </div>
    </div>
  );
}
