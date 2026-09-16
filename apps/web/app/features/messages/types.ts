import type { RoomMode } from '@/features/rooms/types';

/** messages 계약 (API.md#messages). */
export type MessageRole = 'USER' | 'ASSISTANT';
export type InputType = 'TEXT' | 'VOICE';

export type Message = {
  id: number;
  role: MessageRole;
  /** USER 만. ASSISTANT 는 null */
  senderUserId: number | null;
  /** USER 만. 조회 시점 발신자 닉네임 — 나간 멤버도 유지(T-021, D-023). users 행이 없으면 null → 현재 멤버 폴백 */
  senderNickname: string | null;
  content: string;
  inputType: InputType | null;
  /** 발신 당시 방 모드. ASSISTANT 는 null */
  mode: RoomMode | null;
  createdAt: string;
};
