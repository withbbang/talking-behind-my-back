import { describe, expect, it } from 'vitest';
import { appendMessage, flattenMessages, removeMessage, replaceMessageId, type MessagesData } from './cache';
import { userMsg } from './testFixtures';

const data = (...pages: MessagesData['pages']): MessagesData => ({ pages, pageParams: pages.map(() => undefined) });

describe('messages 캐시 헬퍼 (id 내림차순 페이지 → 시간순 평탄화)', () => {
  it('flattenMessages 는 페이지(최신 먼저)를 시간순으로 뒤집는다', () => {
    const d = data({ items: [userMsg(3), userMsg(2)], nextCursor: 'c' }, { items: [userMsg(1)], nextCursor: null });
    expect(flattenMessages(d).map((m) => m.id)).toEqual([1, 2, 3]);
    expect(flattenMessages(undefined)).toEqual([]);
  });

  it('appendMessage 는 첫 페이지 맨 앞에, 같은 id 면 교체(중복 없음)', () => {
    const d = data({ items: [userMsg(2)], nextCursor: null });
    const a = appendMessage(d, userMsg(3));
    expect(a.pages[0].items.map((m) => m.id)).toEqual([3, 2]);
    const b = appendMessage(a, userMsg(3, { content: '수정' }));
    expect(b.pages[0].items).toHaveLength(2);
    expect(b.pages[0].items[0].content).toBe('수정');
  });

  it('appendMessage 는 캐시가 비어도 페이지를 만든다', () => {
    expect(appendMessage(undefined, userMsg(1)).pages[0].items.map((m) => m.id)).toEqual([1]);
  });

  it('replaceMessageId: 임시 id → 서버 id, 서버 id 가 이미 있으면 임시만 제거', () => {
    const d = data({ items: [userMsg(-5, { content: 'x' }), userMsg(2)], nextCursor: null });
    expect(replaceMessageId(d, -5, 9).pages[0].items.map((m) => m.id)).toEqual([9, 2]);
    const dup = data({ items: [userMsg(9), userMsg(-5), userMsg(2)], nextCursor: null });
    expect(replaceMessageId(dup, -5, 9).pages[0].items.map((m) => m.id)).toEqual([9, 2]);
  });

  it('removeMessage', () => {
    const d = data({ items: [userMsg(-5), userMsg(2)], nextCursor: null });
    expect(removeMessage(d, -5).pages[0].items.map((m) => m.id)).toEqual([2]);
  });
});
