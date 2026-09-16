import { create } from 'zustand';
import { initialStreamState, reduceStreams, removeStream, type RoomEvent, type StreamState } from '@/lib/sse';

type StreamStore = {
  rooms: Record<number, StreamState>;
  dispatch: (roomId: number, event: RoomEvent) => void;
  /** 전송 직후(202 전) 내 잡을 임시 id 로 대기 표시 — 입력 잠금을 즉시 건다. */
  markSending: (roomId: number, tempId: number, senderUserId: number) => void;
  /** 202 messageId 로 키 교체. 이벤트가 먼저 와서 서버 id 스트림이 이미 있으면 임시만 지운다. */
  rekey: (roomId: number, tempId: number, id: number) => void;
  remove: (roomId: number, replyTo: number) => void;
  /** 내 AI 잡이 대기·진행 중인가 (오류 상태는 잠금 아님). */
  myPending: (roomId: number, meId: number) => boolean;
};

const of = (rooms: StreamStore['rooms'], roomId: number) => rooms[roomId] ?? initialStreamState;

/** 방별 스트리밍 상태(zustand, UI 전용). 메시지 본문은 React Query 캐시가 진실. */
export const useStreamStore = create<StreamStore>((set, get) => ({
  rooms: {},
  dispatch: (roomId, event) => set((s) => ({ rooms: { ...s.rooms, [roomId]: reduceStreams(of(s.rooms, roomId), event) } })),
  markSending: (roomId, tempId, senderUserId) =>
    set((s) => {
      const cur = of(s.rooms, roomId);
      return {
        rooms: {
          ...s.rooms,
          [roomId]: {
            ...cur,
            streams: { ...cur.streams, [tempId]: { replyTo: tempId, senderUserId, text: '', status: 'waiting', startedAt: new Date().toISOString() } },
          },
        },
      };
    }),
  rekey: (roomId, tempId, id) =>
    set((s) => {
      const cur = of(s.rooms, roomId);
      const temp = cur.streams[tempId];
      if (!temp) return s;
      const without = removeStream(cur, tempId);
      const existing = without.streams[id];
      const merged = existing ? { ...existing, senderUserId: existing.senderUserId ?? temp.senderUserId } : { ...temp, replyTo: id };
      return { rooms: { ...s.rooms, [roomId]: { ...without, streams: { ...without.streams, [id]: merged } } } };
    }),
  remove: (roomId, replyTo) => set((s) => ({ rooms: { ...s.rooms, [roomId]: removeStream(of(s.rooms, roomId), replyTo) } })),
  myPending: (roomId, meId) =>
    Object.values(of(get().rooms, roomId).streams).some((e) => e.senderUserId === meId && e.status !== 'error'),
}));
