import { describe, expect, it } from 'vitest';
import { formatClock, formatDateChip, isSameKstDay, relativeTime } from './time';

// 기준 now = 2026-09-16T12:00:00Z = KST 2026-09-16 21:00 (수요일)
const now = new Date('2026-09-16T12:00:00Z');

describe('relativeTime (D-020 목록 상대시간, KST)', () => {
  it('1분 미만은 방금', () => {
    expect(relativeTime('2026-09-16T11:59:30Z', now)).toBe('방금');
  });
  it('60분 미만은 n분 전', () => {
    expect(relativeTime('2026-09-16T11:15:00Z', now)).toBe('45분 전');
  });
  it('같은 KST 날짜면 n시간 전', () => {
    expect(relativeTime('2026-09-16T01:00:00Z', now)).toBe('11시간 전'); // KST 10:00 → 11시간 전
  });
  it('KST 어제면 어제', () => {
    expect(relativeTime('2026-09-15T14:00:00Z', now)).toBe('어제'); // KST 9/15 23:00
  });
  it('그 이전은 M.D', () => {
    expect(relativeTime('2026-09-01T03:00:00Z', now)).toBe('9.1');
  });
  it('UTC 로는 같은 날이지만 KST 로 어제인 경계', () => {
    // UTC 9/16 00:00 - 9h = KST 9/16 09:00 → 오늘. UTC 9/15 14:59 = KST 9/15 23:59 → 어제
    expect(relativeTime('2026-09-15T14:59:00Z', now)).toBe('어제');
  });
});

describe('formatClock', () => {
  it('KST HH:mm 24시간제', () => {
    expect(formatClock('2026-09-16T12:05:00Z')).toBe('21:05');
    expect(formatClock('2026-09-16T15:30:00Z')).toBe('00:30');
  });
});

describe('formatDateChip', () => {
  it('M월 D일 요일', () => {
    expect(formatDateChip('2026-09-16T12:00:00Z')).toBe('9월 16일 수요일');
    expect(formatDateChip('2026-09-16T15:30:00Z')).toBe('9월 17일 목요일');
  });
});

describe('isSameKstDay', () => {
  it('KST 기준 날짜 비교', () => {
    expect(isSameKstDay('2026-09-16T00:00:00Z', '2026-09-16T14:59:00Z')).toBe(true);
    expect(isSameKstDay('2026-09-16T14:59:00Z', '2026-09-16T15:00:00Z')).toBe(false);
  });
});
