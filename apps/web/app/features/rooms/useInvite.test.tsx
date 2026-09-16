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
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => '/join/K7Q2M9XW' }));

import { ApiError, apiFetch } from '@/lib/api';
import { ROOMS_KEY, roomKey } from './useRooms';
import { joinPreviewKey, useJoinPreview, useJoinRoom, useRegenerateInvite } from './useInvite';
import { roomDetail } from './testFixtures';
import type { JoinPreview, Room } from './types';

const apiFetchMock = vi.mocked(apiFetch);
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const preview: JoinPreview = { roomId: 10, title: '점심', ownerNickname: '영선', memberCount: 1, alreadyMember: false };

describe('useInvite (API.md#rooms join/regenerate)', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    push.mockReset();
    replace.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('useJoinPreview: GET /rooms/join/{code}, 실패는 재시도 없이 error 로', async () => {
    apiFetchMock.mockResolvedValueOnce(preview);
    const { result } = renderHook(() => useJoinPreview('K7Q2M9XW'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(preview));
    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/join/K7Q2M9XW');

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, 'INVITE_NOT_FOUND', 'x'));
    const bad = renderHook(() => useJoinPreview('ZZZZZZZZ'), { wrapper });
    await waitFor(() => expect(bad.result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('useJoinRoom: POST → 상세 캐시 + 목록 무효화 + replace(/rooms/{id}) + 미리보기 캐시 제거', async () => {
    const joined = roomDetail(10, { role: 'PARTICIPANT', memberCount: 2 });
    apiFetchMock.mockResolvedValueOnce(joined);
    client.setQueryData(joinPreviewKey('K7Q2M9XW'), preview);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useJoinRoom('K7Q2M9XW'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/join/K7Q2M9XW', { method: 'POST' });
    expect(client.getQueryData(roomKey(10))).toEqual(joined);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ROOMS_KEY, exact: true });
    expect(replace).toHaveBeenCalledWith('/rooms/10');
    expect(client.getQueryData(joinPreviewKey('K7Q2M9XW'))).toBeUndefined();
  });

  it('useRegenerateInvite: POST regenerate → 상세 캐시의 inviteCode/inviteUrl 만 교체', async () => {
    client.setQueryData(roomKey(10), roomDetail(10));
    apiFetchMock.mockResolvedValueOnce({ inviteCode: 'NEWC0DE7', inviteUrl: 'http://localhost:3000/join/NEWC0DE7' });

    const { result } = renderHook(() => useRegenerateInvite(10), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/rooms/10/invite/regenerate', { method: 'POST' });
    const cached = client.getQueryData<Room>(roomKey(10))!;
    expect(cached.inviteCode).toBe('NEWC0DE7');
    expect(cached.inviteUrl).toBe('http://localhost:3000/join/NEWC0DE7');
    expect(cached.title).toBe('방 10');
  });
});
