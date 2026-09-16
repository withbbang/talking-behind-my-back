import { ApiError } from '@/lib/api';

/**
 * 입장 실패 → 화면 문구 (BRAND.md#5, API.md#rooms 입장 실패 코드). 코드로 매핑해 409 두 종류를 구분한다.
 * 모르는 오류는 null — 화면이 "삐끗했다. 다시 해볼까?" + 다시 버튼으로 처리. 새 코드(예: 쌍당 방 1개 규칙)는 여기 한 줄.
 */
const JOIN_ERROR_COPY: Record<string, string> = {
  INVITE_NOT_FOUND: '그런 코드 없는데?',
  ROOM_FULL: '여긴 벌써 꽉 찼어',
  ROOM_ORPHANED: '주인이 도망간 방이야',
  SELF_INVITE: '이거 네 방이잖아',
  ROOM_LIMIT_EXCEEDED: '방이 50개 넘었어. 하나 정리하고 와',
};

export function joinErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError) return JOIN_ERROR_COPY[err.code] ?? null;
  return null;
}
