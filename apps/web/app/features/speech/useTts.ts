'use client';

import { create } from 'zustand';
import { useToastStore } from '@/components/ui/Toast';
import { GENERIC_ERROR } from '@/lib/copy';
import { synthesize } from './speechApi';
import { createTtsPlayer, type TtsPlayer } from './ttsPlayer';

/**
 * 듣기 재생 상태 (D-029). 재생기는 앱 전역 1개 — 동시 재생 1개, 새 play 가 이전 것을 멈춘다.
 * playingId = 지금 읽는 메시지 id(ListenButton 이 "정지" 로 바뀐다). 실패는 공용 오류 토스트.
 */
type TtsState = {
  playingId: number | null;
  player: TtsPlayer;
  play: (id: number, text: string) => void;
  stop: () => void;
};

export const useTtsStore = create<TtsState>((set, get) => ({
  playingId: null,
  player: createTtsPlayer({
    synthesize,
    createAudio: () => new Audio(),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  }),
  play: (id, text) => {
    const { player } = get();
    player.stop();
    set({ playingId: id });
    player.play(text).then(
      () => {
        if (get().playingId === id) set({ playingId: null });
      },
      () => {
        if (get().playingId === id) set({ playingId: null });
        useToastStore.getState().show(GENERIC_ERROR, 'error');
      },
    );
  },
  stop: () => {
    get().player.stop();
    set({ playingId: null });
  },
}));
