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
