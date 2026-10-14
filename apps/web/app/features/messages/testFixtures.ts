import type { Message } from './types';

/** 테스트 전용. */
export const userMsg = (id: number, over: Partial<Message> = {}): Message => ({
  id,
  role: 'USER',
  senderUserId: 1,
  senderNickname: null,
  content: `메시지 ${id}`,
  inputType: 'TEXT',
  mode: 'AI',
  createdAt: `2026-09-16T12:${String(id % 60).padStart(2, '0')}:00Z`,
  ...over,
});

export const aiMsg = (id: number, over: Partial<Message> = {}): Message => ({
  id,
  role: 'ASSISTANT',
  senderUserId: null,
  senderNickname: null,
  content: `답 ${id}`,
  inputType: null,
  mode: null,
  createdAt: `2026-09-16T12:${String(id % 60).padStart(2, '0')}:30Z`,
  ...over,
});

/** 시스템 라인(D-047). content = 종류 코드, senderUserId·senderNickname = 대상 유저, mode = MODE_CHANGED 의 변경 후 모드. */
export const sysMsg = (id: number, over: Partial<Message> = {}): Message => ({
  id,
  role: 'SYSTEM',
  senderUserId: 2,
  senderNickname: '영희',
  content: 'MEMBER_JOINED',
  inputType: null,
  mode: null,
  createdAt: `2026-09-16T12:${String(id % 60).padStart(2, '0')}:15Z`,
  ...over,
});
