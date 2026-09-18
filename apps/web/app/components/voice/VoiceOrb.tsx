import type { CSSProperties, ReactNode } from 'react';
import type { VoicePhase } from '@/features/speech/voiceMachine';

type Props = {
  phase: VoicePhase;
  /** recording 중 마이크 레벨 0~1 — 오브 크기(--level). 미터가 없으면 0 */
  level?: number;
  children?: ReactNode;
  /** 있으면 오브 자체가 버튼(recording 에서 "녹음 완료") */
  onClick?: () => void;
  buttonLabel?: string;
};

/**
 * 보이스 모드 오브 (DESIGN.md#7, D-034 12). ChatGPT 보이스 모드처럼 중앙 단일 오브 — surface/accent 그라데이션 원 하나.
 * 단계별 모션은 globals.css `.voice-orb[data-phase]` 가 담당(recording 숨쉬기+진폭, speaking 펄스, streaming·transcribing 광택). 내용물(시간·점 3개)은 오브 아래 children.
 */
export function VoiceOrb({ phase, level = 0, children, onClick, buttonLabel }: Props) {
  const style = { '--level': String(level) } as CSSProperties;
  const shape = 'voice-orb block size-[min(220px,56vw)] rounded-full';
  return (
    <div className="flex flex-col items-center gap-6">
      {onClick ? (
        <button
          type="button"
          aria-label={buttonLabel}
          onClick={onClick}
          data-testid="voice-orb"
          data-phase={phase}
          style={style}
          className={`${shape} outline-offset-8 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.97]`}
        />
      ) : (
        <div data-testid="voice-orb" data-phase={phase} style={style} aria-hidden="true" className={shape} />
      )}
      {children && <div className="flex min-h-6 flex-col items-center gap-2">{children}</div>}
    </div>
  );
}
