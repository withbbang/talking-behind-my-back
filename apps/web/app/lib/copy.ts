/** 공용 UI 문구 (D-025). 화면별 문구는 각 컴포넌트에, 여러 곳에서 같은 뜻으로 쓰는 것만 여기. */
export const GENERIC_ERROR = '시스템 오류. 다시 시도해줄래?';

/** 보이스 모드·마이크 문구 (BRAND.md#5, D-029 초안 — 사용자가 REVIEW 이후 수정). */
export const VOICE_COPY = {
  recording: '듣는 중',
  transcribing: '받아적는 중',
  streaming: '답하는 중',
  speaking: '말하는 중',
  denied: '마이크 좀 열어줘. 브라우저 설정에서.',
  empty: '아무 말도 안 들렸는데?',
  limit: '60초까지만 들을 수 있어!',
  aiOnly: 'AI 모드에서만 돼!',
} as const;
/** STT 상한(API.md#speech 60초). 녹음은 여기서 강제 종료한다. */
export const VOICE_MAX_MS = 60_000;
