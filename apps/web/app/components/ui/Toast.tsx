'use client';

import { useEffect } from 'react';

/**
 * 토스트 (DESIGN.md 컴포넌트 목록 Toast). 상단 중앙 고정, duration 뒤 자동 닫힘, 닫기 버튼.
 * 표시 여부는 부모 상태가 가진다(message === null 이면 렌더 없음) — T-008 에서 zustand 스토어로 승격 가능.
 */
export function Toast({
  message,
  onClose,
  duration = 5000,
  tone = 'error',
}: {
  message: string | null;
  onClose: () => void;
  duration?: number;
  tone?: 'error' | 'info';
}) {
  useEffect(() => {
    if (message === null) return;
    const id = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(id);
  }, [message, duration, onClose]);

  if (message === null) return null;

  const toneClass = tone === 'error' ? 'bg-danger text-bg' : 'bg-surface text-on-surface';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div
        role="alert"
        className={`bubble-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${toneClass}`}
      >
        <p className="flex-1 break-keep">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-m-1 rounded-lg p-1 leading-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-current"
        >
          ×
        </button>
      </div>
    </div>
  );
}
