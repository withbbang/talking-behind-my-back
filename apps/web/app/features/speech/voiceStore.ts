import { create } from 'zustand';

/** 보이스 모드가 열린 방 (상단 바 토글 ↔ RoomView 오버레이, T-010). null = 닫힘. */
type VoiceStore = { roomId: number | null; open: (roomId: number) => void; close: () => void };

export const useVoiceStore = create<VoiceStore>((set) => ({
  roomId: null,
  open: (roomId) => set({ roomId }),
  close: () => set({ roomId: null }),
}));
