'use client';

import { SpeakerHigh } from '@phosphor-icons/react';
import { formatElapsed } from '@/features/speech/format';
import type { VoiceState } from '@/features/speech/voiceMachine';
import { VOICE_COPY } from '@/lib/copy';
import { VoiceOrb } from './VoiceOrb';

type Props = {
  state: VoiceState;
  elapsedMs: number;
  /** streaming 중 델타 미리보기 */
  preview: string;
  /** recording 말풍선 탭 = 녹음 완료 */
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
 * 보이스 모드 오버레이 (DESIGN.md#7, D-029). 전체 화면 bg 96% + 뒤 흐림. 말풍선 2개가 말하는 쪽으로 활성.
 * denied/error 는 말풍선 대신 카드. 하단 "다시"(현재 단계 취소 → 녹음) · "끄기".
 */
export function VoiceModeOverlay({ state, elapsedMs, preview, onDone, onRetry, onExit }: Props) {
  const { phase } = state;
  const mineActive = phase === 'recording' || phase === 'transcribing';
  const aiActive = phase === 'streaming' || phase === 'speaking';
  const card = phase === 'denied' ? VOICE_COPY.denied : phase === 'error' ? state.error : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="보이스 모드" className="fixed inset-0 z-50 flex flex-col bg-bg/95 text-ink backdrop-blur-sm">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-6 pt-[env(safe-area-inset-top)]">
        {card !== null ? (
          <p className="bubble-in self-center rounded-[22px] border border-ink/12 px-5 py-4 text-center text-[15px] break-keep">{card}</p>
        ) : (
          <>
            <VoiceOrb side="mine" active={mineActive} onClick={phase === 'recording' ? onDone : undefined} buttonLabel="녹음 완료">
              {phase === 'recording' && (
                <span className="flex flex-col items-center gap-3">
                  <span className="voice-bars flex h-6 items-end gap-1" aria-hidden="true">
                    <i /><i /><i /><i /><i />
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{formatElapsed(elapsedMs)}</span>
                </span>
              )}
              {phase === 'transcribing' && (
                <span data-testid="typing-dots" className="typing-dots inline-flex h-6 items-center gap-1" aria-hidden="true">
                  <i /><i /><i />
                </span>
              )}
              {!mineActive && <SpeakerHigh size={28} weight="bold" aria-hidden="true" className="opacity-60" />}
            </VoiceOrb>
            <VoiceOrb side="ai" active={aiActive}>
              {phase === 'streaming' && preview && <span className="line-clamp-4 text-left text-[15px] leading-relaxed whitespace-pre-wrap">{preview}</span>}
              {phase === 'streaming' && !preview && (
                <span className="typing-dots inline-flex h-6 items-center gap-1" aria-hidden="true">
                  <i /><i /><i />
                </span>
              )}
              {phase === 'speaking' && <SpeakerHigh size={28} weight="bold" aria-hidden="true" className="orb-pulse" />}
              {!aiActive && <SpeakerHigh size={28} weight="bold" aria-hidden="true" className="opacity-60" />}
            </VoiceOrb>
          </>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-[13px] text-muted">
          {LABEL[phase] ?? ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onRetry}
          className="h-11 rounded-2xl border border-ink/12 px-6 text-base font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] motion-safe:transition-transform"
        >
          다시
        </button>
        <button type="button" onClick={onExit} className="h-11 rounded-2xl px-4 text-base text-muted outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">
          끄기
        </button>
      </div>
    </div>
  );
}
