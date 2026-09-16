import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ROOMS_KEY } from '@/features/rooms/useRooms';
import type { Page, RoomMode } from '@/features/rooms/types';
import { apiFetch } from '@/lib/api';
import { appendMessage, flattenMessages, removeMessage, replaceMessageId, type MessagesData } from './cache';
import { useStreamStore } from './streamStore';
import type { InputType, Message } from './types';

export const messagesKey = (roomId: number) => [...ROOMS_KEY, roomId, 'messages'] as const;
const PAGE_SIZE = 30;

/** 과거 메시지. 서버는 id 내림차순, 렌더는 flattenMessages 로 시간순. fetchNextPage = 더 과거. */
export function useMessages(roomId: number) {
  const query = useInfiniteQuery({
    queryKey: messagesKey(roomId),
    queryFn: ({ pageParam }) =>
      apiFetch<Page<Message>>(
        pageParam ? `/rooms/${roomId}/messages?cursor=${encodeURIComponent(pageParam)}&size=${PAGE_SIZE}` : `/rooms/${roomId}/messages?size=${PAGE_SIZE}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  return { ...query, messages: flattenMessages(query.data) };
}

export type SendVars = { content: string; inputType?: InputType };

/**
 * 전송 (API.md POST /rooms/{id}/messages → 202). 낙관적 USER 말풍선을 바로 넣고, 202 의 messageId 로 교체한다.
 * AI 모드면 내 잡을 대기로 표시해 입력을 잠근다(HUMAN 은 응답 없음). 실패 시 되돌리고 오류는 호출자가 토스트로.
 */
export function useSendMessage(roomId: number, ctx: { meId: number; mode: RoomMode }) {
  const client = useQueryClient();
  const store = useStreamStore;
  const key = messagesKey(roomId);

  return useMutation({
    mutationFn: ({ content, inputType = 'TEXT' }: SendVars) =>
      apiFetch<{ messageId: number }>(`/rooms/${roomId}/messages`, { method: 'POST', body: { content, inputType } }),
    onMutate: ({ content, inputType = 'TEXT' }) => {
      const tempId = -Date.now();
      const temp: Message = { id: tempId, role: 'USER', senderUserId: ctx.meId, content, inputType, mode: ctx.mode, createdAt: new Date().toISOString() };
      client.setQueryData<MessagesData>(key, (old) => appendMessage(old, temp));
      if (ctx.mode === 'AI') store.getState().markSending(roomId, tempId, ctx.meId);
      return { tempId };
    },
    onSuccess: ({ messageId }, _vars, { tempId }) => {
      client.setQueryData<MessagesData>(key, (old) => replaceMessageId(old, tempId, messageId));
      if (ctx.mode === 'AI') store.getState().rekey(roomId, tempId, messageId);
      else store.getState().remove(roomId, tempId);
      void client.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
    },
    onError: (_e, _vars, mctx) => {
      if (!mctx) return;
      client.setQueryData<MessagesData>(key, (old) => removeMessage(old, mctx.tempId));
      store.getState().remove(roomId, mctx.tempId);
    },
  });
}
