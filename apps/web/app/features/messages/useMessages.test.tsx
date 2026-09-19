import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>();
  return { ...mod, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from '@/lib/api';
import { roomKey } from '@/features/rooms/useRooms';
import { messagesKey, useMessages, useSendMessage } from './useMessages';
import { useStreamStore } from './streamStore';
import { flattenMessages, type MessagesData } from './cache';
import { userMsg } from './testFixtures';

const apiFetchMock = vi.mocked(apiFetch);
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  apiFetchMock.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useStreamStore.setState({ rooms: {} });
});

describe('useMessages (GET /rooms/{id}/messages 커서)', () => {
  it('첫 페이지 → 시간순 messages, fetchNextPage 는 cursor 로 과거 페이지', async () => {
    apiFetchMock
      .mockResolvedValueOnce({ items: [userMsg(3), userMsg(2)], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [userMsg(1)], nextCursor: null });
    const { result } = renderHook(() => useMessages(10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10/messages?size=30');
    expect(result.current.messages.map((m) => m.id)).toEqual([2, 3]);
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3]));
    expect(apiFetchMock).toHaveBeenLastCalledWith('/rooms/10/messages?cursor=c2&size=30');
    expect(messagesKey(10)).toEqual(['rooms', 10, 'messages']);
  });
});

describe('useSendMessage (POST 202 + 낙관적 렌더 + 내 잡 잠금)', () => {

  it('새로 보내면 그 방의 오류 말풍선은 사라진다 (T-032 실측)', async () => {
    useStreamStore.setState({
      rooms: {
        7: {
          streams: {
            5: { replyTo: 5, senderUserId: 1, text: '', status: 'error', errorMessage: '시스템 오류. 다시 시도해줄래?', startedAt: 'x' },
            6: { replyTo: 6, senderUserId: 2, text: '답 쓰는 중', status: 'streaming', startedAt: 'y' },
          },
          notices: [],
        },
      },
    });
    apiFetchMock.mockResolvedValue({ messageId: 101 });
    const { result } = renderHook(() => useSendMessage(7, { meId: 1, mode: 'AI' }), { wrapper });

    await act(() => result.current.mutateAsync({ content: '다시 물어봄' }));

    // 오류 엔트리만 정리 — 진행 중인 남의 스트림은 건드리지 않는다
    expect(Object.keys(useStreamStore.getState().rooms[7].streams).map(Number).sort((a, b) => a - b)).toEqual([6, 101]);
  });
  it('낙관적 USER 메시지 → 202 messageId 로 교체, 스트림은 내 대기 잡으로 rekey', async () => {
    let resolve!: (v: { messageId: number }) => void;
    apiFetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    client.setQueryData(messagesKey(10), { pages: [{ items: [userMsg(2)], nextCursor: null }], pageParams: [undefined] });
    client.setQueryData(roomKey(10), { title: '새 대화' });

    const { result } = renderHook(() => useSendMessage(10, { meId: 7, mode: 'AI' }), { wrapper });
    let p: Promise<unknown>;
    act(() => {
      p = result.current.mutateAsync({ content: '안녕' });
    });

    const optimistic = flattenMessages(client.getQueryData<MessagesData>(messagesKey(10)));
    expect(optimistic).toHaveLength(2);
    expect(optimistic[1]).toMatchObject({ role: 'USER', senderUserId: 7, content: '안녕', inputType: 'TEXT', mode: 'AI' });
    expect(optimistic[1].id).toBeLessThan(0);
    expect(useStreamStore.getState().myPending(10, 7)).toBe(true);

    resolve({ messageId: 101 });
    await act(async () => {
      await p;
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10/messages', { method: 'POST', body: { content: '안녕', inputType: 'TEXT' } });
    const after = flattenMessages(client.getQueryData<MessagesData>(messagesKey(10)));
    expect(after.map((m) => m.id)).toEqual([2, 101]);
    expect(useStreamStore.getState().rooms[10]?.streams[101]).toMatchObject({ senderUserId: 7, status: 'waiting' });
    // 서버가 첫 메시지로 방 제목을 자동 생성할 수 있다(API.md autoTitle) — 상세 쿼리도 함께 갱신돼야 헤더가 낡지 않는다.
    expect(client.getQueryState(roomKey(10))?.isInvalidated).toBe(true);
  });

  it('HUMAN 모드면 202 후 스트림 대기 없음(잠금 해제)', async () => {
    apiFetchMock.mockResolvedValueOnce({ messageId: 5 });
    const { result } = renderHook(() => useSendMessage(10, { meId: 7, mode: 'HUMAN' }), { wrapper });
    await act(() => result.current.mutateAsync({ content: '몰래' }));
    expect(useStreamStore.getState().myPending(10, 7)).toBe(false);
    expect(flattenMessages(client.getQueryData<MessagesData>(messagesKey(10)))[0]).toMatchObject({ id: 5, mode: 'HUMAN' });
  });

  it('실패(409) → 낙관 메시지·스트림 제거, 오류는 호출자에게', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, 'ROOM_BUSY', '이미 처리 중'));
    const { result } = renderHook(() => useSendMessage(10, { meId: 7, mode: 'AI' }), { wrapper });
    await expect(act(() => result.current.mutateAsync({ content: '안녕' }))).rejects.toMatchObject({ code: 'ROOM_BUSY' });
    // 거절은 onError 정리보다 먼저 전달될 수 있다 — 정리는 곧 따라온다.
    await waitFor(() => expect(flattenMessages(client.getQueryData<MessagesData>(messagesKey(10)))).toEqual([]));
    expect(useStreamStore.getState().myPending(10, 7)).toBe(false);
  });
});
