import { describe, expect, it, vi } from 'vitest';
import { connectRoomEvents, initialStreamState, parseRoomEvent, reduceStreams, removeStream, type RoomEvent } from './sse';
import { aiMsg, userMsg } from '@/features/messages/testFixtures';

const ev = <T extends RoomEvent['type']>(type: T, data: Extract<RoomEvent, { type: T }>['data']) => ({ type, data }) as RoomEvent;

describe('parseRoomEvent (API.md#messages 이벤트 6종)', () => {
  it('알려진 타입은 JSON 파싱, 모르는 타입·깨진 JSON 은 null', () => {
    expect(parseRoomEvent('delta', '{"replyTo":101,"text":"안녕"}')).toEqual({ type: 'delta', data: { replyTo: 101, text: '안녕' } });
    expect(parseRoomEvent('mode', '{"mode":"HUMAN"}')).toEqual({ type: 'mode', data: { mode: 'HUMAN' } });
    expect(parseRoomEvent('typing', '{}')).toBeNull();
    expect(parseRoomEvent('delta', '{oops')).toBeNull();
  });
});

describe('reduceStreams', () => {
  const now = '2026-09-16T12:00:00Z';

  it('AI 모드 USER message → 대기 스트림(replyTo=id, 발신자 기록)', () => {
    const s = reduceStreams(initialStreamState, ev('message', userMsg(101, { senderUserId: 7 })), now);
    expect(s.streams[101]).toMatchObject({ replyTo: 101, senderUserId: 7, text: '', status: 'waiting' });
  });

  it('HUMAN 모드 USER message 나 ASSISTANT message 는 스트림 없음', () => {
    expect(reduceStreams(initialStreamState, ev('message', userMsg(1, { mode: 'HUMAN' })), now).streams).toEqual({});
    expect(reduceStreams(initialStreamState, ev('message', aiMsg(2)), now).streams).toEqual({});
  });

  it('delta 누적 → streaming, 대기 없이 온 delta 도 스트림 생성', () => {
    let s = reduceStreams(initialStreamState, ev('message', userMsg(101)), now);
    s = reduceStreams(s, ev('delta', { replyTo: 101, text: '안녕' }), now);
    s = reduceStreams(s, ev('delta', { replyTo: 101, text: '하세요' }), now);
    expect(s.streams[101]).toMatchObject({ text: '안녕하세요', status: 'streaming' });
    const orphan = reduceStreams(initialStreamState, ev('delta', { replyTo: 5, text: 'x' }), now);
    expect(orphan.streams[5]).toMatchObject({ text: 'x', status: 'streaming', senderUserId: null });
  });

  it('done → 스트림 제거, error → status error + 문구', () => {
    let s = reduceStreams(initialStreamState, ev('message', userMsg(101)), now);
    s = reduceStreams(s, ev('message', userMsg(102, { senderUserId: 2 })), now);
    s = reduceStreams(s, ev('done', { replyTo: 101, message: aiMsg(103), promptTokens: 1, completionTokens: 1 }), now);
    expect(s.streams[101]).toBeUndefined();
    expect(s.lastDone).toEqual({ replyTo: 101, text: aiMsg(103).content }); // 보이스 모드가 내 응답 본문을 읽는다(T-010)
    s = reduceStreams(s, ev('error', { replyTo: 102, code: 'LLM_UPSTREAM_ERROR', message: 'AI 응답에 실패했습니다.' }), now);
    expect(s.streams[102]).toMatchObject({ status: 'error' });
    expect(removeStream(s, 102).streams[102]).toBeUndefined();
  });

  it('mode/member → 시스템 라인(BRAND.md 문구)', () => {
    let s = reduceStreams(initialStreamState, ev('mode', { mode: 'HUMAN' }), now);
    s = reduceStreams(s, ev('member', { action: 'JOINED', userId: 8, nickname: '영희', role: 'PARTICIPANT', roomStatus: 'ACTIVE' }), now);
    s = reduceStreams(s, ev('member', { action: 'LEFT', userId: 8, nickname: '영희', role: 'PARTICIPANT', roomStatus: 'ACTIVE' }), now);
    expect(s.notices.map((n) => n.text)).toEqual(['유저끼리 대화 가능!', '영희 등장!', '영희 퇴장!']);
    expect(s.notices[0].createdAt).toBe(now);
  });

  it('스트림 리듀서는 원본을 바꾸지 않는다', () => {
    const before = initialStreamState;
    reduceStreams(before, ev('delta', { replyTo: 1, text: 'x' }), now);
    expect(before.streams).toEqual({});
  });
});

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, data: string) {
    this.listeners[type]?.forEach((fn) => fn({ data } as MessageEvent));
  }
}

describe('connectRoomEvents', () => {
  it('GET /api/rooms/{id}/events 구독, 6종 이벤트를 파싱해 onEvent, close 로 해제', () => {
    FakeEventSource.instances = [];
    const onEvent = vi.fn();
    const stop = connectRoomEvents(10, { onEvent }, FakeEventSource as unknown as typeof EventSource);
    const es = FakeEventSource.instances[0];
    expect(es.url).toBe('/api/rooms/10/events');
    es.emit('delta', '{"replyTo":1,"text":"a"}');
    es.emit('member', '{"action":"JOINED","userId":8,"nickname":"영희","role":"PARTICIPANT","roomStatus":"ACTIVE"}');
    es.emit('delta', 'not json');
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith({ type: 'delta', data: { replyTo: 1, text: 'a' } });
    stop();
    expect(es.closed).toBe(true);
  });

  it('오류 뒤 다시 열리면 onReconnect (놓친 메시지 보충 트리거)', () => {
    FakeEventSource.instances = [];
    const onReconnect = vi.fn();
    connectRoomEvents(10, { onEvent: vi.fn(), onReconnect }, FakeEventSource as unknown as typeof EventSource);
    const es = FakeEventSource.instances[0];
    es.onopen?.();
    expect(onReconnect).not.toHaveBeenCalled();
    es.onerror?.();
    es.onopen?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('연결이 CLOSED 로 죽으면 백오프 후 새 EventSource 로 재연결', () => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    const onReconnect = vi.fn();
    const stop = connectRoomEvents(10, { onEvent: vi.fn(), onReconnect }, FakeEventSource as unknown as typeof EventSource);
    const first = FakeEventSource.instances[0];
    first.readyState = 2;
    first.onerror?.();
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[1].onopen?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    stop();
    vi.useRealTimers();
  });
});
