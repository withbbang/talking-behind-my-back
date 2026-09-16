import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});
const push = vi.fn();
const replace = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => pathname }));

import { apiFetch } from '@/lib/api';
import { ROOMS_KEY, roomKey, useCreateRoom, useLeaveRoom, usePatchRoom, useRoom, useRooms } from './useRooms';
import type { Room, RoomListItem } from './types';

const apiFetchMock = vi.mocked(apiFetch);

const item = (id: number, over: Partial<RoomListItem> = {}): RoomListItem => ({
  id,
  title: `방 ${id}`,
  role: 'OWNER',
  status: 'ACTIVE',
  mode: 'AI',
  aiPersonality: 'RATIONAL',
  aiPrompt: null,
  effectiveAiPrompt: '프리셋',
  inviteCode: 'K7Q2M9XW',
  inviteUrl: 'http://localhost:3000/join/K7Q2M9XW',
  members: null,
  memberCount: 1,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: '2026-09-16T00:00:00Z',
  ...over,
});
const room = (id: number, over: Partial<Room> = {}): Room => ({
  ...item(id),
  members: [{ userId: 1, nickname: '영선', role: 'OWNER' }],
  ...over,
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  push.mockReset();
  replace.mockReset();
  pathname = '/';
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useRooms (GET /rooms 커서 페이징)', () => {
  it('첫 페이지 size=30, nextCursor 로 다음 페이지, null 이면 끝', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ items: [item(1), item(2)], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [item(3)], nextCursor: null });

    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms?size=30');
    expect(result.current.rooms.map((r) => r.id)).toEqual([1, 2]);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rooms).toHaveLength(3));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/rooms?cursor=c2&size=30');
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useRoom', () => {
  it('GET /rooms/{id}, 키 ["rooms", id]', async () => {
    apiFetchMock.mockResolvedValueOnce(room(10));
    const { result } = renderHook(() => useRoom(10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10');
    expect(client.getQueryData(roomKey(10))).toEqual(room(10));
    expect(roomKey(10)).toEqual([...ROOMS_KEY, 10]);
  });
});

describe('useCreateRoom', () => {
  it('POST /rooms → 목록 무효화 + /rooms/{id} 이동', async () => {
    client.setQueryData(ROOMS_KEY, { pages: [{ items: [item(1)], nextCursor: null }], pageParams: [undefined] });
    apiFetchMock.mockResolvedValueOnce(room(10));

    const { result } = renderHook(() => useCreateRoom(), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(apiFetchMock).toHaveBeenCalledWith('/rooms', { method: 'POST' });
    expect(push).toHaveBeenCalledWith('/rooms/10');
    expect(client.getQueryState(ROOMS_KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryData(roomKey(10))).toEqual(room(10));
  });
});

describe('usePatchRoom', () => {
  it('PATCH 부분 갱신 → 상세 캐시 교체 + 목록 무효화', async () => {
    client.setQueryData(roomKey(10), room(10));
    client.setQueryData(ROOMS_KEY, { pages: [{ items: [item(10)], nextCursor: null }], pageParams: [undefined] });
    apiFetchMock.mockResolvedValueOnce(room(10, { title: '바뀐 제목' }));

    const { result } = renderHook(() => usePatchRoom(10), { wrapper });
    await act(() => result.current.mutateAsync({ title: '바뀐 제목' }));

    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'PATCH', body: { title: '바뀐 제목' } });
    expect((client.getQueryData(roomKey(10)) as Room).title).toBe('바뀐 제목');
    expect(client.getQueryState(ROOMS_KEY)?.isInvalidated).toBe(true);
  });
});

describe('useLeaveRoom', () => {
  it('지금 보고 있는 방을 나가면 DELETE → 상세 캐시 제거 + 목록 무효화 + / 로 replace', async () => {
    pathname = '/rooms/10';
    client.setQueryData(roomKey(10), room(10));
    client.setQueryData(ROOMS_KEY, { pages: [{ items: [item(10)], nextCursor: null }], pageParams: [undefined] });
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLeaveRoom(10), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10', { method: 'DELETE' });
    expect(client.getQueryData(roomKey(10))).toBeUndefined();
    expect(client.getQueryState(ROOMS_KEY)?.isInvalidated).toBe(true);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('사이드바에서 다른(지금 보고 있지 않은) 방을 나가면 이동하지 않는다', async () => {
    pathname = '/rooms/999';
    client.setQueryData(ROOMS_KEY, { pages: [{ items: [item(10)], nextCursor: null }], pageParams: [undefined] });
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLeaveRoom(10), { wrapper });
    await act(() => result.current.mutateAsync());

    expect(client.getQueryState(ROOMS_KEY)?.isInvalidated).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });
});
