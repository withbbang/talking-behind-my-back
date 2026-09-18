'use client';

import type { KeyboardEvent } from 'react';

type Option<T extends string> = { readonly value: T; readonly label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label': string;
  'aria-describedby'?: string;
};

/**
 * 필 토글 (DESIGN.md 공통 컴포넌트). 높이 32, 라운드 9999, 세그먼트. 활성 칸 surface/on-surface, 비활성 ink 12% 테두리.
 * 비활성화 시 60% 투명 + aria-disabled. 활성 표시는 색 + 굵기(600) 둘 다 — 색만으로 구분하지 않는다.
 */
export function PillToggle<T extends string>({ options, value, onChange, disabled, 'aria-label': label, 'aria-describedby': describedBy }: Props<T>) {
  const select = (v: T) => {
    if (disabled || v === value) return;
    onChange(v);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    select(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      className={`inline-flex h-8 rounded-full border border-ink/12 p-0.5 ${disabled ? 'opacity-60' : ''}`}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => select(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`h-full rounded-full px-3.5 text-[13px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${
              checked ? 'bg-surface font-semibold text-on-surface' : 'text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
