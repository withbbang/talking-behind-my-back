'use client';

import { useId, useState, type KeyboardEvent } from 'react';

/** tip 이 있으면 그 칸 호버·포커스·터치 중에만 말풍선으로 뜬다(D-037 4). */
type Option<T extends string> = { readonly value: T; readonly label: string; readonly tip?: string };

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
 * 옵션에 `tip` 을 주면 호버·포커스한 칸의 안내가 토글 **우측 상단에 하나만** 뜬다(D-037 4).
 * 말풍선을 칸마다 두고 CSS `group-hover` 로 켜면 (a) 조상 `.group` 의 hover 에도 걸려 둘이 같이 보이고
 * (b) 칸 가운데 정렬이라 시트 밖으로 삐져나가 가로 스크롤이 생긴다(T-032 실측). 그래서 상태로 하나만 그린다.
 * 스크린리더용 문구는 칸마다 `sr-only` `role="tooltip"` 으로 항상 두고 `aria-describedby` 로 묶는다 — 호버와 무관하게 읽힌다.
 */
export function PillToggle<T extends string>({ options, value, onChange, disabled, 'aria-label': label, 'aria-describedby': describedBy }: Props<T>) {
  const tipBase = useId();
  const [active, setActive] = useState<number | null>(null);
  const activeTip = active === null ? null : options[active].tip;
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
      className={`relative inline-flex h-8 rounded-full border border-ink/12 p-0.5 ${disabled ? 'opacity-60' : ''}`}
    >
      {activeTip && (
        <span
          aria-hidden="true"
          className="bubble-in pointer-events-none absolute right-0 bottom-full mb-2 rounded-full rounded-br-[4px] bg-surface px-3 py-1.5 text-xs font-medium whitespace-nowrap text-on-surface"
        >
          {activeTip}
        </span>
      )}
      {options.map((o, i) => {
        const checked = o.value === value;
        const tipId = `${tipBase}-${o.value}`;
        return (
          <span key={o.value} className="contents">
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              aria-describedby={o.tip ? tipId : undefined}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => select(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              onPointerEnter={() => o.tip && setActive(i)}
              onPointerLeave={() => setActive((cur) => (cur === i ? null : cur))}
              onFocus={() => o.tip && setActive(i)}
              onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              className={`h-full rounded-full px-3.5 text-[13px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${
                checked ? 'bg-surface font-semibold text-on-surface' : 'text-ink'
              }`}
            >
              {o.label}
            </button>
            {o.tip && (
              <span role="tooltip" id={tipId} className="sr-only">
                {o.tip}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
