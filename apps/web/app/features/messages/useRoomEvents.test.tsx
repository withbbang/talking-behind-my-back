import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
vi.mock('@/lib/sse', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/sse')>();
  return { ...mod, connectRoomEvents: vi.fn() };
});

import { connectRoomEvents, type RoomEvent } from '@/lib/sse';
import { ApiError, apiFetch } from '@/lib/api';
import { roomKey, ROOMS_KEY } from '@/features/rooms/useRooms';
import { roomDetail } from '@/features/rooms/testFixtures';
import type { Room } from '@/features/rooms/types';
import { messagesKey } from './useMessages';
import { useRoomEvents } from './useRoomEvents';
import { useStreamStore } from './streamStore';
import { flattenMessages, type MessagesData } from './cache';
import { aiMsg, userMsg } from './testFixtures';

const connectMock = vi.mocked(connectRoomEvents);
let client: QueryClient;
let handlers: Parameters<typeof connectRoomEvents>[1];
const stop = vi.fn();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const fire = (e: RoomEvent) => act(() => handlers.onEvent(e));

beforeEach(() => {
  connectMock.mockReset();
  stop.mockReset();
  connectMock.mockImplementation((_id, h) => {
    handlers = h;
    return stop;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(roomKey(10), roomDetail(10));
  client.setQueryData(messagesKey(10), { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] });
  useStreamStore.setState({ rooms: {} });
});

describe('useRoomEvents (SSE → React Query 캐시 + 스트림 스토어)', () => {
  it('마운트 시 구독, 언마운트 시 해제', () => {
    const { unmount } = renderHook(() => useRoomEvents(10), { wrapper });
    expect(connectMock).toHaveBeenCalledWith(10, expect.any(Object));
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('enabled=false(방 없음·접근 불가)면 구독하지 않는다 (T-046)', () => {
    renderHook(() => useRoomEvents(10, false), { wrapper });
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('재연결 전 방 조회가 404 면 재연결하지 않고 상세를 무효화한다 (T-046)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(404, 'ROOM_NOT_FOUND', 'x'));
    renderHook(() => useRoomEvents(10), { wrapper });
    await expect(handlers.shouldReconnect?.()).resolves.toBe(false);
    expect(apiFetch).toHaveBeenCalledWith('/rooms/10');
    expect(client.getQueryState(roomKey(10))?.isInvalidated).toBe(true);
  });

  it('재연결 전 방 조회가 네트워크 오류면 계속 재연결한다', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderHook(() => useRoomEvents(10), { wrapper });
    await expect(handlers.shouldReconnect?.()).resolves.toBe(true);
  });

  it('message → 메시지 캐시 추가 + 방 목록·상세 무효화, 스트림 대기', () => {
    client.setQueryData(ROOMS_KEY, { pages: [], pageParams: [] });
    renderHook(() => useRoomEvents(10), { wrapper });
    fire({ type: 'message', data: userMsg(101, { senderUserId: 2 }) });
    expect(flattenMessages(client.getQueryData<MessagesData>(messagesKey(10))).map((m) => m.id)).toEqual([101]);
    expect(useStreamStore.getState().rooms[10]?.streams[101]).toMatchObject({ status: 'waiting', senderUserId: 2 });
    expect(client.getQueryState(ROOMS_KEY)?.isInvalidated).toBe(true);
    // 첫 메시지면 서버가 방 제목을 자동 생성한다(API.md autoTitle) — 상세도 함께 무효화해야 헤더/시트가 낡지 않는다.
    expect(client.getQueryState(roomKey(10))?.isInvalidated).toBe(true);
  });

  it('delta 누적 → done 이면 ASSISTANT 저장 + 스트림 제거', () => {
    renderHook(() => useRoomEvents(10), { wrapper });
    fire({ type: 'message', data: userMsg(101) });
    fire({ type: 'delta', data: { replyTo: 101, text: '안녕' } });
    expect(useStreamStore.getState().rooms[10]?.streams[101]?.text).toBe('안녕');
    fire({ type: 'done', data: { replyTo: 101, message: aiMsg(102), promptTokens: 1, completionTokens: 1 } });
    expect(flattenMessages(client.getQueryData<MessagesData>(messagesKey(10))).map((m) => m.id)).toEqual([101, 102]);
    expect(useStreamStore.getState().rooms[10]?.streams[101]).toBeUndefined();
  });

  it('mode → 방 캐시 mode 갱신, member → 멤버·인원·상태 갱신', () => {
    renderHook(() => useRoomEvents(10), { wrapper });
    fire({ type: 'mode', data: { mode: 'HUMAN' } });
    expect(client.getQueryData<Room>(roomKey(10))?.mode).toBe('HUMAN');

    fire({ type: 'member', data: { action: 'JOINED', userId: 8, nickname: '영희', role: 'PARTICIPANT', roomStatus: 'ACTIVE' } });
    let room = client.getQueryData<Room>(roomKey(10))!;
    expect(room.memberCount).toBe(2);
    expect(room.members.map((m) => m.nickname)).toEqual(['영선', '영희']);

    fire({ type: 'member', data: { action: 'LEFT', userId: 8, nickname: '영희', role: 'PARTICIPANT', roomStatus: 'ACTIVE' } });
    room = client.getQueryData<Room>(roomKey(10))!;
    expect(room.memberCount).toBe(1);
    expect(room.members).toHaveLength(1);

    fire({ type: 'member', data: { action: 'LEFT', userId: 1, nickname: '영선', role: 'OWNER', roomStatus: 'ORPHANED' } });
    expect(client.getQueryData<Room>(roomKey(10))?.status).toBe('ORPHANED');
  });

  it('재연결 → 메시지 쿼리 무효화(놓친 메시지 보충)', () => {
    renderHook(() => useRoomEvents(10), { wrapper });
    act(() => handlers.onReconnect?.());
    expect(client.getQueryState(messagesKey(10))?.isInvalidated).toBe(true);
  });
});
