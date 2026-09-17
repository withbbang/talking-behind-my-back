/**
 * TTS 텍스트 상한(API.md#speech 1,000자) 분할 (D-029). 개행은 단락 경계(항상 자름), 문장 부호(. ! ? …)는 문장 경계(상한 안에서 묶음).
 * 길이는 서버 `String.length()` 와 같은 UTF-16 단위. 한 문장이 max 를 넘으면 max 단위로 강제 분할(서로게이트 쌍은 가르지 않음).
 * T-026(문장 단위 선재생)이 같은 함수를 쓴다.
 */
export const TTS_MAX_CHARS = 1000;

const SENTENCE = /[^.!?…]+[.!?…]*|[.!?…]+/g;

export function splitForTts(text: string, max: number = TTS_MAX_CHARS): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    const sentences = (paragraph.match(SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean);
    let cur = '';
    const flush = () => {
      if (cur) out.push(cur);
      cur = '';
    };
    for (const sentence of sentences) {
      for (const piece of hardSplit(sentence, max)) {
        if (!cur) cur = piece;
        else if (cur.length + 1 + piece.length <= max) cur += ` ${piece}`;
        else {
          flush();
          cur = piece;
        }
      }
    }
    flush();
  }
  return out;
}

function hardSplit(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const pieces: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    // 마지막 단위가 상위 서로게이트면 한 칸 물러나 이모지를 가르지 않는다
    if (end < s.length && /[\uD800-\uDBFF]/.test(s[end - 1])) end -= 1;
    pieces.push(s.slice(i, end));
    i = end;
  }
  return pieces;
}
