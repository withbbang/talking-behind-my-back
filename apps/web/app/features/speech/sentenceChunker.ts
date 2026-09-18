/**
 * SSE 델타를 문장 단위 TTS 청크로 자르는 증분 파서 (D-033 B1·B2).
 * 경계 = 문장 부호(. ! ? …) 뒤에 공백/개행이 온 지점, 또는 개행. 부호 뒤가 숫자면(3.14) 경계가 아니다. 부호 뒤 문자가 아직 안 왔으면 기다린다.
 * 첫 문장은 경계가 나오는 즉시 낸다(첫 소리까지의 지연 최소). 이후는 완성 문장이 minChars 이상 모여야 한 덩어리로 낸다(TTS 호출 수 억제).
 * flush() 는 done 뒤 남은 완성 문장 + 꼬리를 합쳐 돌려준다. 1,000자 상한 분할은 ttsPlayer 가 splitForTts 로 한다.
 */
export const CHUNK_MIN_CHARS = 40;

export type SentenceChunker = {
  feed: (delta: string) => string[];
  flush: () => string | null;
};

const BOUNDARY = /[.!?…]+(?=\s)|\n/g;

export function createSentenceChunker({ minChars = CHUNK_MIN_CHARS }: { minChars?: number } = {}): SentenceChunker {
  let buf = '';
  let pending = '';
  let first = true;

  const takeSentences = (): string[] => {
    const out: string[] = [];
    let last = 0;
    for (const m of buf.matchAll(BOUNDARY)) {
      const end = m.index + m[0].length;
      const sentence = buf.slice(last, end).trim();
      if (sentence) out.push(sentence);
      last = end;
    }
    buf = buf.slice(last);
    return out;
  };

  return {
    feed(delta) {
      buf += delta;
      const out: string[] = [];
      for (const sentence of takeSentences()) {
        if (first) {
          first = false;
          out.push(sentence);
          continue;
        }
        pending = pending ? `${pending} ${sentence}` : sentence;
        if (pending.length >= minChars) {
          out.push(pending);
          pending = '';
        }
      }
      return out;
    },
    flush() {
      const tail = buf.trim();
      const text = [pending, tail].filter(Boolean).join(' ');
      buf = '';
      pending = '';
      return text || null;
    },
  };
}
