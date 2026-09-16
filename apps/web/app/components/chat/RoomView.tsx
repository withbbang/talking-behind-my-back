'use client';

import { useCallback } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToastStore } from '@/components/ui/Toast';
import { useMe } from '@/features/auth/useMe';
import { useStreamStore } from '@/features/messages/streamStore';
import { useMessages, useSendMessage } from '@/features/messages/useMessages';
import { useRoomEvents } from '@/features/messages/useRoomEvents';
import { useRoom } from '@/features/rooms/useRooms';
import { ApiError } from '@/lib/api';
import { initialStreamState } from '@/lib/sse';
import { MessageList } from './MessageList';

/**
 * 채팅방 본문 (DESIGN.md#3). 방 상세 + 메시지 + 이벤트 구독 + 스트리밍. 입력창(Composer)은 커밋 4.
 */
export function RoomView({ roomId }: { roomId: number }) {
  const room = useRoom(roomId);
  const me = useMe();
  const messages = useMessages(roomId);
  useRoomEvents(roomId);
  const stream = useStreamStore((s) => s.rooms[roomId]) ?? initialStreamState;
  const removeStream = useStreamStore((s) => s.remove);
  const show = useToastStore((s) => s.show);
  const send = useSendMessage(roomId, { meId: me.data?.id ?? 0, mode: room.data?.mode ?? 'AI' });

  const retry = useCallback(
    (replyTo: number) => {
      const original = messages.messages.find((m) => m.id === replyTo);
      removeStream(roomId, replyTo);
      if (!original) return;
      send.mutate({ content: original.content, inputType: original.inputType ?? 'TEXT' }, { onError: (e) => show(e instanceof ApiError ? e.message : '삐끗했다. 다시 해볼까?', 'error') });
    },
    [messages.messages, removeStream, roomId, send, show],
  );

  if (room.isPending || me.isPending || messages.isPending) {
    return (
      <div className="px-4 pt-4">
        <Skeleton lines={3} label="방 불러오는 중" lineClassName="h-12 w-3/4" />
      </div>
    );
  }
  if (room.isError || me.isError || messages.isError) {
    const err = room.error ?? messages.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return <Centered>{notFound ? '그런 방 없는데?' : '삐끗했다. 다시 해볼까?'}</Centered>;
  }

  const empty = messages.messages.length === 0 && Object.keys(stream.streams).length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {empty ? (
        <Centered>
          <Avatar kind="ai" size={64} />
          <span>오늘은 누가 그랬어?</span>
        </Centered>
      ) : (
        <MessageList
          messages={messages.messages}
          meId={me.data.id}
          members={room.data.members}
          stream={stream}
          hasOlder={messages.hasNextPage}
          isLoadingOlder={messages.isFetchingNextPage}
          onLoadOlder={() => void messages.fetchNextPage()}
          onRetry={retry}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bubble-in flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-[15px] text-muted break-keep">
      {children}
    </div>
  );
}
