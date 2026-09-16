import { ApiError } from '@/lib/api';

/**
 * 전송 실패 → 화면 문구 (BRAND.md#5, API.md POST messages 판정). 400 은 서버 메시지 그대로(길이 초과 등).
 * 410(ROOM_ORPHANED)은 null — 토스트 대신 useSendMessage 가 캐시 status 를 바꿔 ORPHANED 모달이 뜬다(D-021).
 */
export function sendErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError) {
    if (err.status === 409) return '아직 답 쓰는 중. 좀만 기다려';
    if (err.status === 503) return '지금 너무 바빠. 잠깐 뒤에 다시 해봐';
    if (err.status === 410) return null;
    if (err.status === 400) return err.message;
  }
  return '삐끗했다. 다시 해볼까?';
}
