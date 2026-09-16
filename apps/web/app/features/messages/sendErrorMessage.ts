import { ApiError } from '@/lib/api';

/** 전송 실패 → 화면 문구 (BRAND.md#5, API.md POST messages 판정). 400 은 서버 메시지 그대로(길이 초과 등). */
export function sendErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return '아직 답 쓰는 중. 좀만 기다려';
    if (err.status === 503) return '지금 너무 바빠. 잠깐 뒤에 다시 해봐';
    if (err.status === 410) return '주인이 도망간 방이야';
    if (err.status === 400) return err.message;
  }
  return '삐끗했다. 다시 해볼까?';
}
