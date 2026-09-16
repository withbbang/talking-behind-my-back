import type { RoomMode } from '@/features/rooms/types';

/** messages 계약 (API.md#messages). */
export type MessageRole = 'USER' | 'ASSISTANT';
export type InputType = 'TEXT' | 'VOICE';

export type Message = {
  id: number;
  role: MessageRole;
  /** USER 만. ASSISTANT 는 null */
  senderUserId: number | null;
  content: string;
  inputType: InputType | null;
  /** 발신 당시 방 모드. ASSISTANT 는 null */
  mode: RoomMode | null;
  createdAt: string;
};
