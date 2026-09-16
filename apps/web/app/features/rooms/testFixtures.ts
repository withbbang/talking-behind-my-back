import type { Room, RoomListItem } from './types';

/** 테스트 전용 픽스처. 프로덕션 코드에서 import 금지. */
export const roomItem = (id: number, over: Partial<RoomListItem> = {}): RoomListItem => ({
  id,
  title: `방 ${id}`,
  role: 'OWNER',
  status: 'ACTIVE',
  mode: 'AI',
  aiPersonality: 'RATIONAL',
  aiPrompt: null,
  effectiveAiPrompt: '프리셋 문구',
  inviteCode: 'K7Q2M9XW',
  inviteUrl: 'http://localhost:3000/join/K7Q2M9XW',
  members: null,
  memberCount: 1,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: '2026-09-16T00:00:00Z',
  ...over,
});

export const roomDetail = (id: number, over: Partial<Room> = {}): Room => ({
  ...roomItem(id),
  members: [{ userId: 1, nickname: '영선', role: 'OWNER' }],
  ...over,
});
