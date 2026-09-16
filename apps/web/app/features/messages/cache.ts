import type { InfiniteData } from '@tanstack/react-query';
import type { Page } from '@/features/rooms/types';
import type { Message } from './types';

/** 메시지 무한쿼리 캐시 — 페이지 안은 id 내림차순(최신 먼저), 페이지 순서도 최신 페이지가 앞. */
export type MessagesData = InfiniteData<Page<Message>, unknown>;

const empty = (): MessagesData => ({ pages: [{ items: [], nextCursor: null }], pageParams: [undefined] });

/** 시간순(과거 → 최신) 평탄화. 렌더용. */
export function flattenMessages(data: MessagesData | undefined): Message[] {
  if (!data) return [];
  const out: Message[] = [];
  for (let p = data.pages.length - 1; p >= 0; p--) {
    const items = data.pages[p].items;
    for (let i = items.length - 1; i >= 0; i--) out.push(items[i]);
  }
  return out;
}

/** 새 메시지를 첫 페이지 맨 앞에. 같은 id 가 이미 있으면 그 자리에서 교체(이벤트/202 중복 대비). */
export function appendMessage(data: MessagesData | undefined, message: Message): MessagesData {
  const d = data ?? empty();
  const exists = d.pages.some((p) => p.items.some((m) => m.id === message.id));
  if (exists) {
    return { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === message.id ? message : m)) })) };
  }
  const [first, ...rest] = d.pages.length ? d.pages : empty().pages;
  return { ...d, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
}

/** 낙관적 임시 id → 서버 id. 서버 id 가 이미 들어와 있으면 임시만 지운다. */
export function replaceMessageId(data: MessagesData | undefined, tempId: number, id: number): MessagesData {
  const d = data ?? empty();
  const hasReal = d.pages.some((p) => p.items.some((m) => m.id === id));
  return {
    ...d,
    pages: d.pages.map((p) => ({
      ...p,
      items: hasReal ? p.items.filter((m) => m.id !== tempId) : p.items.map((m) => (m.id === tempId ? { ...m, id } : m)),
    })),
  };
}

export function removeMessage(data: MessagesData | undefined, id: number): MessagesData {
  const d = data ?? empty();
  return { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((m) => m.id !== id) })) };
}
