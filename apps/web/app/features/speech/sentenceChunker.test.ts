import { describe, expect, it } from 'vitest';
import { createSentenceChunker } from './sentenceChunker';

describe('createSentenceChunker (SSE 델타 → 문장 단위 TTS 청크, D-033 B1·B2)', () => {
  it('경계가 없으면 아무것도 내지 않고 flush 가 꼬리를 돌려준다', () => {
    const c = createSentenceChunker();
    expect(c.feed('안녕 반가')).toEqual([]);
    expect(c.feed('워')).toEqual([]);
    expect(c.flush()).toBe('안녕 반가워');
    expect(c.flush()).toBeNull();
  });

  it('첫 문장은 부호 뒤 공백이 오는 즉시 낸다(길이 무관)', () => {
    const c = createSentenceChunker();
    expect(c.feed('안녕.')).toEqual([]); // 부호 뒤에 뭐가 올지 아직 모른다
    expect(c.feed(' 반가워')).toEqual(['안녕.']);
    expect(c.flush()).toBe('반가워');
  });

  it('개행은 그 자체로 경계', () => {
    const c = createSentenceChunker();
    expect(c.feed('안녕\n반가워')).toEqual(['안녕']);
  });

  it('소수점(부호 뒤 숫자)은 경계가 아니다', () => {
    const c = createSentenceChunker();
    expect(c.feed('값은 3.14 야. 응')).toEqual(['값은 3.14 야.']);
  });

  it('첫 문장 이후는 완성 문장이 minChars(40) 이상 모여야 한 덩어리로 낸다', () => {
    const c = createSentenceChunker();
    expect(c.feed('첫 문장. ')).toEqual(['첫 문장.']);
    expect(c.feed('짧아. 또 짧아. ')).toEqual([]);
    const long = '이건 사십 자를 채우려고 일부러 아주 길게 늘여서 쓰는 문장인데 진짜 길다. ';
    expect(long.trim().length).toBeGreaterThanOrEqual(40);
    expect(c.feed(long)).toEqual([`짧아. 또 짧아. ${long.trim()}`]);
  });

  it('한 델타에 경계가 여럿이면 첫 문장만 즉시, 나머지는 버퍼', () => {
    const c = createSentenceChunker();
    expect(c.feed('하나. 둘. ')).toEqual(['하나.']);
    expect(c.flush()).toBe('둘.');
  });

  it('done 후 flush 는 버퍼에 남은 완성 문장 + 꼬리를 합쳐 준다', () => {
    const c = createSentenceChunker();
    c.feed('하나! ');
    c.feed('둘? 셋');
    expect(c.flush()).toBe('둘? 셋');
  });

  it('공백·개행뿐이면 아무것도 내지 않는다', () => {
    const c = createSentenceChunker();
    expect(c.feed('  \n \n')).toEqual([]);
    expect(c.flush()).toBeNull();
  });

  it('minChars 는 옵션', () => {
    const c = createSentenceChunker({ minChars: 5 });
    c.feed('하나. ');
    expect(c.feed('둘셋넷다. ')).toEqual(['둘셋넷다.']);
  });
});
