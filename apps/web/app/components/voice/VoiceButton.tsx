'use client';

import { Waveform } from '@phosphor-icons/react';
import { useTtsStore } from '@/features/speech/useTts';
import { useVoiceStore } from '@/features/speech/voiceStore';

/** 컴포저 보이스 모드 토글 (DESIGN.md#3·#7, D-034 1) — 마이크와 전송 사이 원 40. 노출 조건(AI 모드·ORPHANED 아님)은 RoomView 가 판단한다. 탭 제스처에서 재생기 unlock(iOS). */
export function VoiceButton({ roomId }: { roomId: number }) {
  const open = useVoiceStore((s) => s.roomId === roomId);
  const openRoom = useVoiceStore((s) => s.open);
  const close = useVoiceStore((s) => s.close);
  const player = useTtsStore((s) => s.player);

  return (
    <button
      type="button"
      aria-label="음성"
      aria-pressed={open}
      onClick={() => {
        player.unlock();
        if (open) close();
        else openRoom(roomId);
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink/12 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.96] motion-safe:transition-transform aria-pressed:border-transparent aria-pressed:bg-surface aria-pressed:text-on-surface"
    >
      <Waveform size={20} weight="bold" />
    </button>
  );
}
