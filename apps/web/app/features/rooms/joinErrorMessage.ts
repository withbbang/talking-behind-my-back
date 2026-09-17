import { ApiError } from '@/lib/api';

/**
 * 입장 실패 → 화면 문구 (BRAND.md#5, API.md#rooms 입장 실패 코드). 코드로 매핑해 409 두 종류를 구분한다.
 * 모르는 오류는 null — 화면이 "시스템 오류. 다시 시도해줄래?" + 다시 버튼으로 처리. 새 코드(예: 쌍당 방 1개 규칙)는 여기 한 줄.
 */
const JOIN_ERROR_COPY: Record<string, string> = {
  INVITE_NOT_FOUND: '그런 방 없는데?',
  ROOM_FULL: '여긴 벌써 꽉 찼어',
  ROOM_ORPHANED: '방장이 도망간 방이야!',
  SELF_INVITE: '네 방 아니야?',
  ROOM_LIMIT_EXCEEDED: '방이 50개 넘었어. 정리하고 와!',
  PAIR_ROOM_EXISTS: '걔랑은 이미 대화하고 있어!',
};

export function joinErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError) return JOIN_ERROR_COPY[err.code] ?? null;
  return null;
}
