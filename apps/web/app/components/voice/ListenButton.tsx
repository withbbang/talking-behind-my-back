'use client';

import { SpeakerHigh, Stop } from '@phosphor-icons/react';
import { useTtsStore } from '@/features/speech/useTts';

/** AI 말풍선 듣기 (DESIGN.md#7). 24px 원형, 터치 영역은 가상 요소로 44px. 재생 중이면 "정지". 탭 = 사용자 제스처 → 재생기 unlock(iOS). */
export function ListenButton({ messageId, text }: { messageId: number; text: string }) {
  const playing = useTtsStore((s) => s.playingId === messageId);
  const play = useTtsStore((s) => s.play);
  const stop = useTtsStore((s) => s.stop);
  const player = useTtsStore((s) => s.player);

  const onClick = () => {
    if (playing) {
      stop();
      return;
    }
    player.unlock();
    play(messageId, text);
  };

  return (
    <button
      type="button"
      aria-label={playing ? '정지' : '듣기'}
      aria-pressed={playing}
      onClick={onClick}
      className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/12 text-ink outline-offset-2 after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform aria-pressed:bg-surface aria-pressed:text-on-surface"
    >
      {playing ? <Stop size={12} weight="fill" /> : <SpeakerHigh size={14} weight="bold" />}
    </button>
  );
}
