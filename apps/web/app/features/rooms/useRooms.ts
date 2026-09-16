import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Page, Room, RoomListItem, RoomPatch } from './types';

export const ROOMS_KEY = ['rooms'] as const;
export const roomKey = (id: number) => [...ROOMS_KEY, id] as const;
const PAGE_SIZE = 30;

/** 내 방 목록. 커서는 불투명 문자열 — 서버가 준 nextCursor 를 그대로 되돌린다(API.md#공통). */
export function useRooms() {
  const query = useInfiniteQuery({
    queryKey: ROOMS_KEY,
    queryFn: ({ pageParam }) =>
      apiFetch<Page<RoomListItem>>(pageParam ? `/rooms?cursor=${encodeURIComponent(pageParam)}&size=${PAGE_SIZE}` : `/rooms?size=${PAGE_SIZE}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rooms = query.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...query, rooms };
}

/** 방 상세. id 가 null 이면(방 밖) 조회하지 않는다. */
export function useRoom(id: number | null) {
  return useQuery({
    queryKey: roomKey(id ?? 0),
    queryFn: () => apiFetch<Room>(`/rooms/${id}`),
    enabled: id !== null,
  });
}

/** "+ 새 방" — 즉시 생성 후 이동 (D-020, D-010 폐기). */
export function useCreateRoom() {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiFetch<Room>('/rooms', { method: 'POST' }),
    onSuccess: (room) => {
      client.setQueryData(roomKey(room.id), room);
      void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
      router.push(`/rooms/${room.id}`);
    },
  });
}

export function usePatchRoom(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: RoomPatch) => apiFetch<Room>(`/rooms/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: (room) => {
      client.setQueryData(roomKey(id), room);
      void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
    },
  });
}

/**
 * 나가기. 개설자면 방이 ORPHANED, 참여자면 멤버십 종료(API.md).
 * 지금 보고 있는 방을 나갔을 때만 / 로 이동한다(최신 방 또는 빈 상태) — 사이드바 목록에서 다른(안 보고 있는) 방을
 * 정리할 때 보던 화면이 갑자기 바뀌면 안 된다.
 */
export function useLeaveRoom(id: number) {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/rooms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.removeQueries({ queryKey: roomKey(id) });
      void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
      if (pathname === `/rooms/${id}`) router.replace('/');
    },
  });
}
