import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { joinErrorMessage } from './joinErrorMessage';

// BRAND.md#5 입장 실패 문구. 코드 우선 매핑이라 상태코드가 겹쳐도(409 둘) 구분된다. 모르는 오류는 null → 화면이 "삐끗했다" + 다시.
describe('joinErrorMessage (DESIGN.md#5 실패 표)', () => {
  it.each([
    [new ApiError(404, 'INVITE_NOT_FOUND', 'x'), '그런 코드 없는데?'],
    [new ApiError(409, 'ROOM_FULL', 'x'), '여긴 벌써 꽉 찼어'],
    [new ApiError(410, 'ROOM_ORPHANED', 'x'), '주인이 도망간 방이야'],
    [new ApiError(400, 'SELF_INVITE', 'x'), '이거 네 방이잖아'],
    [new ApiError(409, 'ROOM_LIMIT_EXCEEDED', 'x'), '방이 50개 넘었어. 하나 정리하고 와'],
  ])('%s → %s', (err, expected) => {
    expect(joinErrorMessage(err)).toBe(expected);
  });

  it('모르는 코드·네트워크 오류는 null', () => {
    expect(joinErrorMessage(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toBeNull();
    expect(joinErrorMessage(new ApiError(409, 'SOMETHING_NEW', 'x'))).toBeNull();
    expect(joinErrorMessage(new Error('network'))).toBeNull();
  });
});
