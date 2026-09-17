'use client';

import { useEffect, useId, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  busy?: boolean;
};

/**
 * 확인 모달 (DESIGN.md 공통 컴포넌트). 폭 320, 라운드 24, 버튼 1~2개. 닫기 X 없음 — 버튼으로만.
 * 뒤는 ink 40% 딤. 열리면 주 버튼에 포커스, Escape 는 onCancel(있을 때만).
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, busy }: Props) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bubble-in w-full max-w-[320px] rounded-3xl bg-bg p-6 text-ink"
      >
        <h2 id={titleId} className="text-[17px] leading-snug font-semibold break-keep whitespace-pre-line">
          {title}
        </h2>
        {body && <p className="mt-2 text-[15px] leading-relaxed text-muted break-keep">{body}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-13 w-full rounded-2xl bg-surface text-base font-semibold text-on-surface outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform disabled:opacity-60"
          >
            {confirmLabel}
          </button>
          {cancelLabel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 w-full rounded-2xl text-base font-semibold text-ink outline-offset-3 focus-visible:outline-3 focus-visible:outline-accent"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
