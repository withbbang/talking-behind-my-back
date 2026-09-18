'use client';

import { ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { formatElapsed } from '@/features/speech/format';
import type { VoiceState } from '@/features/speech/voiceMachine';
import { VOICE_COPY } from '@/lib/copy';
import { VoiceOrb } from './VoiceOrb';

type Props = {
  state: VoiceState;
  elapsedMs: number;
  /** streaming 중 델타 미리보기 */
  preview: string;
  /** recording 중 마이크 레벨 0~1 (D-033 A4) — 오브 크기. 미터가 없으면 0 */
  level?: number;
  /** recording 오브 탭 = 녹음 완료 */
  onDone: () => void;
  onRetry: () => void;
  onExit: () => void;
};

const LABEL: Partial<Record<VoiceState['phase'], string>> = {
  recording: VOICE_COPY.recording,
  transcribing: VOICE_COPY.transcribing,
  streaming: VOICE_COPY.streaming,
  speaking: VOICE_COPY.speaking,
};

/**
 * 보이스 모드 오버레이 (DESIGN.md#7, D-034 12 — ChatGPT 보이스 모드 구성). 전체 화면 bg, 중앙 단일 오브 + 아래 상태 라벨(+ 응답 미리보기),
 * 우측 상단 X("끄기"), 하단 "다시"(현재 단계 취소 → 녹음) 원형 버튼 하나. denied/error 는 오브 대신 카드.
 */
export function VoiceModeOverlay({ state, elapsedMs, preview, level = 0, onDone, onRetry, onExit }: Props) {
  const { phase } = state;
  const card = phase === 'denied' ? VOICE_COPY.denied : phase === 'error' ? state.error : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="보이스 모드" className="fixed inset-0 z-50 flex flex-col bg-bg text-ink">
      <div className="flex h-14 shrink-0 items-center justify-end px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          aria-label="끄기"
          onClick={onExit}
          className="flex size-11 items-center justify-center rounded-full text-muted outline-offset-[-3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X size={24} weight="bold" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
        {card !== null ? (
          <p className="bubble-in rounded-[22px] border border-ink/12 px-5 py-4 text-center text-[15px] break-keep">{card}</p>
        ) : (
          <VoiceOrb phase={phase} level={level} onClick={phase === 'recording' ? onDone : undefined} buttonLabel="녹음 완료">
            {phase === 'recording' && <span className="text-[15px] font-semibold tabular-nums">{formatElapsed(elapsedMs)}</span>}
            {(phase === 'transcribing' || (phase === 'streaming' && !preview)) && (
              <span data-testid="typing-dots" className="typing-dots inline-flex h-6 items-center gap-1" aria-hidden="true">
                <i /><i /><i />
              </span>
            )}
          </VoiceOrb>
        )}
        <div className="flex max-w-[min(360px,86vw)] flex-col items-center gap-2">
          <p role="status" aria-live="polite" className="min-h-5 text-center text-[15px] font-medium text-muted">
            {LABEL[phase] ?? ''}
          </p>
          {phase === 'streaming' && preview && (
            <p className="line-clamp-3 text-center text-[13px] leading-relaxed text-muted break-keep whitespace-pre-wrap">{preview}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="다시"
          onClick={onRetry}
          className="flex size-14 items-center justify-center rounded-full border border-ink/12 outline-offset-2 hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform"
        >
          <ArrowCounterClockwise size={24} weight="bold" />
        </button>
        <span aria-hidden="true" className="text-[13px] text-muted">
          다시
        </span>
      </div>
    </div>
  );
}
