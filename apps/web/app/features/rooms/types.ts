/** rooms 계약 (API.md#rooms). */
export type RoomRole = 'OWNER' | 'PARTICIPANT';
export type RoomStatus = 'ACTIVE' | 'ORPHANED';
export type RoomMode = 'AI' | 'HUMAN';
export type AiPersonality = 'RATIONAL' | 'EMOTIONAL';

export type RoomMember = { userId: number; nickname: string; role: RoomRole };

export type RoomBase = {
  id: number;
  title: string;
  /** 요청자의 역할 */
  role: RoomRole;
  status: RoomStatus;
  mode: RoomMode;
  aiPersonality: AiPersonality;
  aiPrompt: string | null;
  effectiveAiPrompt: string;
  /** 개설자에게만, 참여자는 null */
  inviteCode: string | null;
  inviteUrl: string | null;
  memberCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
};

/** GET /rooms 항목 — members 는 null */
export type RoomListItem = RoomBase & { members: null };
/** GET /rooms/{id} */
export type Room = RoomBase & { members: RoomMember[] };

export type RoomPatch = Partial<Pick<Room, 'title' | 'mode' | 'aiPersonality' | 'aiPrompt'>>;

export type Page<T> = { items: T[]; nextCursor: string | null };

/** GET /rooms/join/{code} 미리보기. alreadyMember = 이미 활성 멤버(버튼 "다시 들어가기", D-021). */
export type JoinPreview = { roomId: number; title: string; ownerNickname: string | null; memberCount: number; alreadyMember: boolean };

/** POST /rooms/{id}/invite/regenerate */
export type InviteResponse = { inviteCode: string; inviteUrl: string };

export const AI_PERSONALITY_LABEL: Record<AiPersonality, string> = {
  RATIONAL: '차분한 편',
  EMOTIONAL: '공감형',
};
