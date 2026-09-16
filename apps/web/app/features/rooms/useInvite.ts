import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { InviteResponse, JoinPreview, Room } from './types';
import { ROOMS_KEY, roomKey } from './useRooms';

export const joinPreviewKey = (code: string) => ['join', code] as const;

/** 입장 미리보기 (API.md GET /rooms/join/{code}). 실패 코드가 곧 화면 상태라 재시도하지 않는다. */
export function useJoinPreview(code: string) {
  return useQuery({
    queryKey: joinPreviewKey(code),
    queryFn: () => apiFetch<JoinPreview>(`/rooms/join/${encodeURIComponent(code)}`),
    retry: false,
  });
}

/** 입장 (POST /rooms/join/{code}) → 상세 캐시에 넣고 목록 갱신 → `/rooms/{id}` 로 replace(뒤로 가기에 초대장이 남지 않게). */
export function useJoinRoom(code: string) {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiFetch<Room>(`/rooms/join/${encodeURIComponent(code)}`, { method: 'POST' }),
    onSuccess: (room) => {
      client.setQueryData(roomKey(room.id), room);
      client.removeQueries({ queryKey: joinPreviewKey(code) });
      void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
      router.replace(`/rooms/${room.id}`);
    },
  });
}

/** 초대 코드 재발급 (개설자, POST /rooms/{id}/invite/regenerate). 응답은 코드·URL 뿐이라 상세 캐시의 두 필드만 교체. */
export function useRegenerateInvite(roomId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<InviteResponse>(`/rooms/${roomId}/invite/regenerate`, { method: 'POST' }),
    onSuccess: (invite) => {
      client.setQueryData<Room>(roomKey(roomId), (old) => (old ? { ...old, ...invite } : old));
    },
  });
}
