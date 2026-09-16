import { describe, expect, it } from 'vitest';
import { iGa } from './josa';

// "{닉}이(가) 부른 방" (BRAND.md#5) — 받침 유무로 이/가 선택. 한글이 아니면 병기.
describe('iGa', () => {
  it('받침 있으면 이, 없으면 가', () => {
    expect(iGa('영선')).toBe('영선이');
    expect(iGa('철수')).toBe('철수가');
    expect(iGa('영희')).toBe('영희가');
  });

  it('마지막 글자가 한글이 아니면 이(가) 병기', () => {
    expect(iGa('Alex')).toBe('Alex이(가)');
    expect(iGa('민지7')).toBe('민지7이(가)');
    expect(iGa('')).toBe('이(가)');
  });
});
