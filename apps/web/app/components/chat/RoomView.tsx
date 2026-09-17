'use client';

import { useCallback } from 'react';
import { GENERIC_ERROR } from '@/lib/copy';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToastStore } from '@/components/ui/Toast';
import { useMe } from '@/features/auth/useMe';
import { useStreamStore } from '@/features/messages/streamStore';
import { sendErrorMessage } from '@/features/messages/sendErrorMessage';
import { useMessages, useSendMessage } from '@/features/messages/useMessages';
import { useRoomEvents } from '@/features/messages/useRoomEvents';
import { useRoom } from '@/features/rooms/useRooms';
import { ApiError } from '@/lib/api';
import { Composer, type ComposerLock } from './Composer';
import { initialStreamState } from '@/lib/sse';
import { MessageList } from './MessageList';
import { OrphanedDialog } from './OrphanedDialog';

/**
 * 채팅방 본문 (DESIGN.md#3). 방 상세 + 메시지 + 이벤트 구독 + 스트리밍 + 입력창.
 * 내 AI 잡이 대기·진행 중이면 입력 잠금(상대는 가능).
 * ORPHANED 방(참여자): 잠금 + 주인 없는 방 모달(DESIGN.md#6). 트리거는 캐시 status 하나 — 목록 탭(상세 GET)·SSE member·전송 410 모두 여기로 모인다(D-021).
 */
export function RoomView({ roomId }: { roomId: number }) {
  const room = useRoom(roomId);
  const me = useMe();
  const messages = useMessages(roomId);
  useRoomEvents(roomId);
  const stream = useStreamStore((s) => s.rooms[roomId]) ?? initialStreamState;
  const removeStream = useStreamStore((s) => s.remove);
  const meId = me.data?.id ?? 0;
  const myPending = Object.values(stream.streams).some((e) => e.senderUserId === meId && e.status !== 'error');
  const show = useToastStore((s) => s.show);
  const send = useSendMessage(roomId, { meId: me.data?.id ?? 0, mode: room.data?.mode ?? 'AI' });
  const toastSendError = useCallback(
    (e: unknown) => {
      const message = sendErrorMessage(e); // 410 은 null — 캐시 status 가 바뀌어 모달이 뜬다
      if (message) show(message, 'error');
    },
    [show],
  );

  const retry = useCallback(
    (replyTo: number) => {
      const original = messages.messages.find((m) => m.id === replyTo);
      removeStream(roomId, replyTo);
      if (!original) return;
      send.mutate({ content: original.content, inputType: original.inputType ?? 'TEXT' }, { onError: toastSendError });
    },
    [messages.messages, removeStream, roomId, send, toastSendError],
  );
  const onSend = (content: string) => send.mutate({ content }, { onError: toastSendError });

  if (room.isPending || me.isPending || messages.isPending) {
    return (
      <div className="px-4 pt-4">
        <Skeleton lines={3} label="방 불러오는 중..." lineClassName="h-12 w-3/4" />
      </div>
    );
  }
  if (room.isError || me.isError || messages.isError) {
    const err = room.error ?? messages.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return <Centered>{notFound ? '그런 방 없는데?' : GENERIC_ERROR}</Centered>;
  }

  // 빈 방 = 메시지·스트림·시스템 라인 전부 0 (DESIGN.md#3, T-024). "영희 등장!" 만 있어도 목록으로.
  const empty = messages.messages.length === 0 && Object.keys(stream.streams).length === 0 && stream.notices.length === 0;
  const orphaned = room.data.status === 'ORPHANED';
  const lock: ComposerLock = orphaned ? 'orphaned' : myPending ? 'pending' : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OrphanedDialog roomId={roomId} open={orphaned && room.data.role === 'PARTICIPANT'} />
      {empty ? (
        <Centered>
          <Avatar kind="ai" size={64} />
          <span>오늘은 누가 짜증나게 했어?</span>
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
      <Composer mode={room.data.mode} lock={lock} onSend={onSend} />
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
