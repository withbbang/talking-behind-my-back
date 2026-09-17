import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';

type Props = {
  side: 'mine' | 'ai';
  active: boolean;
  children: ReactNode;
  /** 있으면 말풍선 자체가 버튼(recording 에서 "녹음 완료") */
  onClick?: () => void;
  buttonLabel?: string;
};

/**
 * 보이스 모드 말풍선 오브 (DESIGN.md#7, D-029). mine = 우측 surface(우하단 꼬리), ai = 좌측 bg + 테두리 + 좌하단 꼬리 + 하트 아바타.
 * 비활성 쪽은 45% 로 남겨 "둘이 대화하는 장면"을 유지한다.
 */
export function VoiceOrb({ side, active, children, onClick, buttonLabel }: Props) {
  const mine = side === 'mine';
  const shape = `flex min-h-[112px] w-[min(240px,72vw)] items-center justify-center rounded-[26px] px-5 py-4 text-center break-keep ${
    mine ? 'rounded-br-[6px] bg-surface text-on-surface' : 'rounded-bl-[6px] border border-ink/12 bg-bg text-ink'
  }`;
  const body = onClick ? (
    <button type="button" aria-label={buttonLabel} onClick={onClick} className={`${shape} outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform`}>
      {children}
    </button>
  ) : (
    <div className={shape}>{children}</div>
  );

  return (
    <div
      data-testid={`orb-${side}`}
      data-active={String(active)}
      className={`flex items-end gap-2 motion-safe:transition-opacity ${mine ? 'self-end' : 'self-start'} ${active ? 'opacity-100' : 'opacity-45'}`}
    >
      {!mine && <Avatar kind="ai" />}
      <div className="relative">
        {body}
        {!mine && (
          <svg viewBox="0 0 14 10" aria-hidden="true" className="absolute -bottom-[7px] left-3 h-2.5 w-3.5">
            <path d="M0 0h14c-3 1.5-6 5-7 10C6 5 3 1.5 0 0z" className="fill-ink/12" />
            <path d="M1.5 0.9h11c-2.5 1.3-4.8 4.2-5.5 7.6C6.3 5.1 4 2.2 1.5 0.9z" className="fill-bg" />
          </svg>
        )}
      </div>
    </div>
  );
}
