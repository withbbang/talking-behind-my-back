import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type { Room } from '@/features/rooms/types';
import { ROOMS_KEY, roomKey } from '@/features/rooms/useRooms';
import { connectRoomEvents, type RoomEvent } from '@/lib/sse';
import { appendMessage, type MessagesData } from './cache';
import { useStreamStore } from './streamStore';
import { messagesKey } from './useMessages';

/**
 * 방 이벤트 구독 → React Query 캐시(메시지·방 상세·목록) + 스트림 스토어 반영.
 * 재연결 시 메시지 쿼리를 무효화해 놓친 메시지를 보충한다(D-019). 방을 나가면(언마운트) 해제.
 * `enabled=false`(방 조회 404 등)면 구독하지 않고, 끊긴 뒤 재연결 전 방이 404 면 멈춘다(T-046).
 */
export function useRoomEvents(roomId: number, enabled = true) {
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const dispatch = useStreamStore.getState().dispatch;

    const onEvent = (event: RoomEvent) => {
      dispatch(roomId, event);
      switch (event.type) {
        case 'message':
          client.setQueryData<MessagesData>(messagesKey(roomId), (old) => appendMessage(old, event.data));
          void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
          // 첫 메시지면 서버가 방 제목을 자동 생성한다(API.md autoTitle) — 헤더/시트가 읽는 상세 쿼리도 갱신.
          void client.invalidateQueries({ queryKey: roomKey(roomId), exact: true });
          break;
        case 'done':
          client.setQueryData<MessagesData>(messagesKey(roomId), (old) => appendMessage(old, event.data.message));
          void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
          break;
        case 'mode':
          client.setQueryData<Room>(roomKey(roomId), (old) => (old ? { ...old, mode: event.data.mode } : old));
          break;
        case 'member': {
          const { action, userId, nickname, role, roomStatus } = event.data;
          client.setQueryData<Room>(roomKey(roomId), (old) => {
            if (!old) return old;
            const rest = old.members.filter((m) => m.userId !== userId);
            const members = action === 'JOINED' ? [...rest, { userId, nickname, role }] : rest;
            return { ...old, members, memberCount: members.length, status: roomStatus };
          });
          void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
          break;
        }
      }
    };

    return connectRoomEvents(roomId, {
      onEvent,
      onReconnect: () => void client.invalidateQueries({ queryKey: messagesKey(roomId) }),
      shouldReconnect: async () => {
        try {
          await apiFetch(`/rooms/${roomId}`);
          return true;
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            void client.invalidateQueries({ queryKey: roomKey(roomId), exact: true }); // 화면도 "그런 방 없는데?" 로
            return false;
          }
          return true; // 네트워크 오류 등은 평소처럼 재연결
        }
      },
    });
  }, [roomId, client, enabled]);
}
