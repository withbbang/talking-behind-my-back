import { describe, expect, it } from 'vitest';
import { safeNextPath } from './nextPath';

// api NextPath.sanitize 와 같은 규칙 (API.md#auth, D-021): 앱 내부 상대경로만.
describe('safeNextPath', () => {
  it('상대경로는 그대로', () => {
    expect(safeNextPath('/join/K7Q2M9XW')).toBe('/join/K7Q2M9XW');
    expect(safeNextPath('/rooms/12?tab=info&x=1')).toBe('/rooms/12?tab=info&x=1');
    expect(safeNextPath('/')).toBe('/');
  });

  it.each([
    'http://evil.example/x',
    '//evil.example/x',
    '/\\evil',
    'join/K7',
    '',
    '/join/\nK7',
    '/join/한글',
    '/join/K7 Q2',
    'javascript:alert(1)',
    null,
    undefined,
    '/' + 'a'.repeat(200),
  ])('불량 %j → null', (raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });
});
