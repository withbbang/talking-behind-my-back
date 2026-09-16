import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { sendErrorMessage } from './sendErrorMessage';

describe('sendErrorMessage (BRAND.md#5 오류 카피)', () => {
  it.each([
    [new ApiError(409, 'ROOM_BUSY', '이미 처리 중'), '아직 답 쓰는 중. 좀만 기다려'],
    [new ApiError(503, 'AI_BUSY', '포화'), '지금 너무 바빠. 잠깐 뒤에 다시 해봐'],
    [new ApiError(410, 'ROOM_ORPHANED', '이탈'), null], // 토스트 대신 ORPHANED 모달 (D-021)
    [new ApiError(400, 'VALIDATION_FAILED', '내용이 너무 길어요.'), '내용이 너무 길어요.'],
    [new ApiError(500, 'INTERNAL_ERROR', '서버 오류'), '삐끗했다. 다시 해볼까?'],
    [new Error('network'), '삐끗했다. 다시 해볼까?'],
  ])('%s → %s', (err, expected) => {
    expect(sendErrorMessage(err)).toBe(expected);
  });
});
