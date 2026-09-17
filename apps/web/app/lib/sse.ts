/**
 * 방 이벤트 SSE (API.md#messages `GET /rooms/{id}/events`, D-018/D-019).
 * - parseRoomEvent / reduceStreams 는 순수 함수 — 단위 테스트 대상 (CONVENTIONS.md#프론트).
 * - connectRoomEvents 는 EventSource 래퍼. 브라우저 자동 재연결에 맡기되 CLOSED 로 죽으면 백오프(1→2→4→8s)로 새로 연다.
 *   재연결 성공 시 onReconnect — 호출자가 GET messages 로 놓친 메시지를 보충한다.
 * - `/api` rewrite 금지(TASKS.md 교훈) — 같은 오리진 nginx 경유 상대 경로.
 */
import type { Message } from '@/features/messages/types';
import type { RoomMode, RoomRole, RoomStatus } from '@/features/rooms/types';

export type RoomEvent =
  | { type: 'message'; data: Message }
  | { type: 'delta'; data: { replyTo: number; text: string } }
  | { type: 'done'; data: { replyTo: number; message: Message; promptTokens: number; completionTokens: number } }
  | { type: 'error'; data: { replyTo: number; code: string; message: string } }
  | { type: 'mode'; data: { mode: RoomMode } }
  | { type: 'member'; data: { action: 'JOINED' | 'LEFT'; userId: number; nickname: string; role: RoomRole; roomStatus: RoomStatus } };

const EVENT_TYPES = ['message', 'delta', 'done', 'error', 'mode', 'member'] as const satisfies readonly RoomEvent['type'][];

export function parseRoomEvent(type: string, raw: string): RoomEvent | null {
  if (!(EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    return { type, data: JSON.parse(raw) } as RoomEvent;
  } catch {
    return null;
  }
}

export type StreamStatus = 'waiting' | 'streaming' | 'error';
export type StreamEntry = {
  replyTo: number;
  /** 트리거 USER 메시지 발신자 — "내 잡" 판정(입력 잠금)용. 모르면 null */
  senderUserId: number | null;
  text: string;
  status: StreamStatus;
  errorMessage?: string;
  startedAt: string;
};
export type Notice = { id: string; text: string; createdAt: string };
/** 마지막 done — 보이스 모드가 내 replyTo 의 assistant 본문을 읽는다(T-010). */
export type StreamState = { streams: Record<number, StreamEntry>; notices: Notice[]; lastDone?: { replyTo: number; text: string } };

export const initialStreamState: StreamState = { streams: {}, notices: [] };

const MODE_NOTICE: Record<RoomMode, string> = {
  HUMAN: '유저끼리 대화 가능!',
  AI: 'AI랑 대화 가능!',
};

let noticeSeq = 0;
const notice = (text: string, createdAt: string): Notice => ({ id: `n${++noticeSeq}`, text, createdAt });

export function reduceStreams(state: StreamState, event: RoomEvent, now: string = new Date().toISOString()): StreamState {
  switch (event.type) {
    case 'message': {
      const m = event.data;
      if (m.role !== 'USER' || m.mode !== 'AI') return state;
      const existing = state.streams[m.id];
      return {
        ...state,
        streams: {
          ...state.streams,
          [m.id]: existing
            ? { ...existing, senderUserId: m.senderUserId }
            : { replyTo: m.id, senderUserId: m.senderUserId, text: '', status: 'waiting', startedAt: m.createdAt },
        },
      };
    }
    case 'delta': {
      const { replyTo, text } = event.data;
      const cur = state.streams[replyTo] ?? { replyTo, senderUserId: null, text: '', status: 'waiting' as StreamStatus, startedAt: now };
      return { ...state, streams: { ...state.streams, [replyTo]: { ...cur, text: cur.text + text, status: 'streaming' } } };
    }
    case 'done':
      return { ...removeStream(state, event.data.replyTo), lastDone: { replyTo: event.data.replyTo, text: event.data.message.content } };
    case 'error': {
      const { replyTo, message } = event.data;
      const cur = state.streams[replyTo] ?? { replyTo, senderUserId: null, text: '', startedAt: now };
      return { ...state, streams: { ...state.streams, [replyTo]: { ...cur, status: 'error', errorMessage: message } } };
    }
    case 'mode':
      return { ...state, notices: [...state.notices, notice(MODE_NOTICE[event.data.mode], now)] };
    case 'member': {
      const { action, nickname } = event.data;
      return { ...state, notices: [...state.notices, notice(action === 'JOINED' ? `${nickname} 등장!` : `${nickname} 퇴장!`, now)] };
    }
  }
}

export function removeStream(state: StreamState, replyTo: number): StreamState {
  if (!(replyTo in state.streams)) return state;
  const streams = { ...state.streams };
  delete streams[replyTo];
  return { ...state, streams };
}

export type RoomEventHandlers = { onEvent: (event: RoomEvent) => void; onReconnect?: () => void };

const CLOSED = 2; // EventSource.CLOSED
const MAX_BACKOFF_MS = 8_000;

export function connectRoomEvents(roomId: number, handlers: RoomEventHandlers, EventSourceImpl: typeof EventSource | undefined = globalThis.EventSource): () => void {
  if (!EventSourceImpl) return () => {}; // SSR·jsdom
  let es: EventSource | null = null;
  let hadError = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const open = () => {
    if (stopped) return;
    es = new EventSourceImpl(`/api/rooms/${roomId}/events`);
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e: MessageEvent) => {
        const event = parseRoomEvent(type, e.data);
        if (event) handlers.onEvent(event);
      });
    }
    es.onopen = () => {
      if (hadError) handlers.onReconnect?.();
      hadError = false;
      attempt = 0;
    };
    es.onerror = () => {
      hadError = true;
      if (es?.readyState === CLOSED) {
        es.close();
        const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** attempt);
        attempt += 1;
        timer = setTimeout(open, delay);
      }
    };
  };

  open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    es?.close();
  };
}
