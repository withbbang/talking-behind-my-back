'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

export type ToastTone = 'info' | 'error';

/**
 * 토스트 (DESIGN.md 공통 컴포넌트, D-020). 상단 중앙 필, 그림자·닫기 버튼 없음, 3초.
 * 안내 = surface/on-surface, 오류 = danger-bg/danger (bg 위에 얹어 불투명하게).
 */
export function Toast({
  message,
  onClose,
  duration = 3000,
  tone = 'info',
}: {
  message: string | null;
  onClose: () => void;
  duration?: number;
  tone?: ToastTone;
}) {
  useEffect(() => {
    if (message === null) return;
    const id = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(id);
  }, [message, duration, onClose]);

  if (message === null) return null;

  const toneClass = tone === 'error' ? 'bg-danger-bg text-danger' : 'bg-surface text-on-surface';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div className="bubble-in rounded-full bg-bg">
        <p role="alert" className={`rounded-full px-4 py-2.5 text-sm font-medium break-keep ${toneClass}`}>
          {message}
        </p>
      </div>
    </div>
  );
}

type ToastState = {
  toast: { message: string; tone: ToastTone; key: number } | null;
  show: (message: string, tone?: ToastTone) => void;
  clear: () => void;
};

/** 앱 전역 토스트. 연속 show 는 마지막 것으로 교체된다(key 로 타이머 리셋). */
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'info') => set({ toast: { message, tone, key: Date.now() + Math.random() } }),
  clear: () => set({ toast: null }),
}));

export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const clear = useToastStore((s) => s.clear);
  return <Toast key={toast?.key} message={toast?.message ?? null} tone={toast?.tone} onClose={clear} />;
}
