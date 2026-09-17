import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { sendErrorMessage } from './sendErrorMessage';

describe('sendErrorMessage (BRAND.md#5 오류 카피)', () => {
  it.each([
    [new ApiError(409, 'ROOM_BUSY', '이미 처리 중'), '아직 답 쓰는 중. 좀만 기다려줘!'],
    [new ApiError(503, 'AI_BUSY', '포화'), '지금 바쁘니깐 잠깐 뒤에 다시 해봐!'],
    [new ApiError(410, 'ROOM_ORPHANED', '이탈'), null], // 토스트 대신 ORPHANED 모달 (D-021)
    [new ApiError(400, 'VALIDATION_FAILED', '입력값이 올바르지 않습니다.'), '불가능한 요청이야!'],
    [new ApiError(500, 'INTERNAL_ERROR', '서버 오류'), '시스템 오류. 다시 시도해줄래?'],
    [new Error('network'), '시스템 오류. 다시 시도해줄래?'],
  ])('%s → %s', (err, expected) => {
    expect(sendErrorMessage(err)).toBe(expected);
  });
});
