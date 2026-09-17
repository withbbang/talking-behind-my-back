'use client';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GENERIC_ERROR } from '@/lib/copy';
import { useToastStore } from '@/components/ui/Toast';
import { useLeaveRoom } from '@/features/rooms/useRooms';

/**
 * 주인 없는 방 모달 (DESIGN.md#6, 참여자). 트리거는 RoomView 가 캐시 `room.status === 'ORPHANED'` 로 판단한다(D-021).
 * "나가기" → DELETE /rooms/{id}(API.md: ORPHANED 방에서 참여자 DELETE = 확인 처리) → 목록 갱신 → `/`. 닫기 없음.
 */
export function OrphanedDialog({ roomId, open }: { roomId: number; open: boolean }) {
  const leave = useLeaveRoom(roomId);
  const show = useToastStore((s) => s.show);
  return (
    <ConfirmDialog
      open={open}
      title="이용할 수 없는 채팅방이야."
      body="방장이 도망간 방이야!"
      confirmLabel="나가기"
      busy={leave.isPending}
      onConfirm={() => leave.mutate(undefined, { onError: () => show(GENERIC_ERROR, 'error') })}
    />
  );
}
