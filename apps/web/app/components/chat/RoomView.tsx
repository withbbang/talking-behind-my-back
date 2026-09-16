'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRoom } from '@/features/rooms/useRooms';
import { ApiError } from '@/lib/api';

/**
 * 채팅방 본문 (DESIGN.md#3). 커밋 1 은 골격 — 빈 방 상태와 오류만. 메시지 목록·스트리밍은 커밋 3, 입력창은 커밋 4.
 */
export function RoomView({ roomId }: { roomId: number }) {
  const room = useRoom(roomId);

  if (room.isPending) {
    return (
      <div className="px-4 pt-4">
        <Skeleton lines={3} label="방 불러오는 중" lineClassName="h-12 w-3/4" />
      </div>
    );
  }
  if (room.isError) {
    const notFound = room.error instanceof ApiError && room.error.status === 404;
    return <Centered>{notFound ? '그런 방 없는데?' : '삐끗했다. 다시 해볼까?'}</Centered>;
  }
  if (room.data.messageCount === 0) {
    return (
      <Centered>
        <Avatar kind="ai" size={64} />
        <span>오늘은 누가 그랬어?</span>
      </Centered>
    );
  }
  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bubble-in flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-[15px] text-muted break-keep">
      {children}
    </div>
  );
}
