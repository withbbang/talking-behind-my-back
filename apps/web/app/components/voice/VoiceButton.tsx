'use client';

import { Waveform } from '@phosphor-icons/react';
import { useTtsStore } from '@/features/speech/useTts';
import { useVoiceStore } from '@/features/speech/voiceStore';

/** 상단 바 보이스 모드 토글 (DESIGN.md#2·#7). 노출 조건(AI 모드·ORPHANED 아님)은 ChatShell 이 판단한다. 탭 제스처에서 재생기 unlock(iOS). */
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
      className="flex size-11 items-center justify-center rounded-full outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-surface aria-pressed:text-on-surface"
    >
      <Waveform size={24} weight="bold" />
    </button>
  );
}
