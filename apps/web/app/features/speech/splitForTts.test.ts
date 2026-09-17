import { describe, expect, it } from 'vitest';
import { splitForTts } from './splitForTts';

describe('splitForTts (TTS 1,000자 상한 — 문장 경계 분할, D-029)', () => {
  it('상한 이하면 한 덩어리(trim)', () => {
    expect(splitForTts('  안녕, 반가워.  ')).toEqual(['안녕, 반가워.']);
  });

  it('공백뿐이면 빈 배열', () => {
    expect(splitForTts('   \n ')).toEqual([]);
  });

  it('문장 경계(. ! ? … 개행)에서 잘라 각 덩어리가 max 이하가 되게 묶는다', () => {
    const text = '하나야. 둘이야! 셋이야? 넷이야… 다섯이야\n여섯이야';
    expect(splitForTts(text, 12)).toEqual(['하나야. 둘이야!', '셋이야? 넷이야…', '다섯이야', '여섯이야']);
  });

  it('한 문장이 max 를 넘으면 max 단위로 강제 분할', () => {
    expect(splitForTts('가'.repeat(25), 10)).toEqual(['가'.repeat(10), '가'.repeat(10), '가'.repeat(5)]);
  });

  it('길이는 UTF-16 단위(이모지 2자) — 서버 String.length() 와 같은 기준', () => {
    const chunks = splitForTts('😀'.repeat(6), 4);
    expect(chunks).toEqual(['😀😀', '😀😀', '😀😀']);
    expect(chunks.every((c) => c.length <= 4)).toBe(true);
  });

  it('기본 max 는 1,000', () => {
    const one = 'a'.repeat(1000);
    expect(splitForTts(one)).toEqual([one]);
    expect(splitForTts(one + 'b')).toHaveLength(2);
  });
});
