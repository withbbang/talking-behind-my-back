/**
 * 적응형 VAD (D-033 A1·A2) — 순수 함수. useRecorder 가 AnalyserNode 시간 영역 샘플을 rmsDb 로 바꿔 50ms 마다 stepVad 에 먹인다.
 * 노이즈 바닥(floorDb)은 내려갈 땐 즉시, 올라갈 땐 riseDbPerSec 로만 따라간다(말소리는 순간적, 소음은 꾸준하다는 가정).
 * 발화 = 바닥+speakMarginDb 초과, 무음 = 바닥+silenceMarginDb 미만, 그 사이는 직전 판정 유지(히스테리시스).
 * 누적 발화가 minSpeechMs 이상이어야 "말했다"(spoke) — 클릭 소리에 안 걸리게. spoke 뒤 무음이 holdMs 이상이면 shouldStop.
 * 발화가 없으면 절대 shouldStop 이 아니다(60초 상한은 useRecorder 의 maxMs 가 맡는다).
 * 한계: 바닥보다 speakMarginDb 이상 큰 꾸준한 소음은 계속 발화로 보여 자동 종료가 안 된다 — 60초 상한 또는 "녹음 완료" 탭.
 */
export const VAD_DEFAULTS = {
  speakMarginDb: 12,
  silenceMarginDb: 6,
  holdMs: 1000,
  minSpeechMs: 200,
  riseDbPerSec: 4,
  /** level 이 1 이 되는 바닥 대비 dB */
  levelRangeDb: 30,
  /** 첫 프레임 바닥 상한 — 처음부터 말하고 있어도 발화로 잡히게 */
  initialFloorCapDb: -50,
} as const;

export type VadOptions = typeof VAD_DEFAULTS;

export type VadState = {
  floorDb: number;
  /** 아직 프레임을 못 받았으면 false — 첫 프레임에서 바닥을 잡는다 */
  primed: boolean;
  speaking: boolean;
  spoke: boolean;
  speechMs: number;
  silenceMs: number;
  /** 바닥 기준 0~1 (오브 진폭용) */
  level: number;
  shouldStop: boolean;
};

const MIN_DB = -100;

export function initialVadState(floorDb?: number): VadState {
  return { floorDb: floorDb ?? MIN_DB, primed: floorDb !== undefined, speaking: false, spoke: false, speechMs: 0, silenceMs: 0, level: 0, shouldStop: false };
}

export function rmsDb(samples: Float32Array): number {
  if (samples.length === 0) return MIN_DB;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (rms <= 0) return MIN_DB;
  return Math.max(MIN_DB, 20 * Math.log10(rms));
}

export function stepVad(state: VadState, db: number, frameMs: number, opts: VadOptions = VAD_DEFAULTS): VadState {
  const base = state.primed ? Math.min(state.floorDb, db) : Math.min(db, opts.initialFloorCapDb);
  const over = db - base;
  const speaking = over > opts.speakMarginDb ? true : over < opts.silenceMarginDb ? false : state.speaking;
  // 바닥은 말하지 않는 프레임에서만 천천히 올라간다(발화가 바닥에 흡수되지 않게)
  const floorDb = speaking || !state.primed ? base : Math.min(db, base + (opts.riseDbPerSec * frameMs) / 1000);
  const speechMs = speaking ? state.speechMs + frameMs : state.speechMs;
  const spoke = state.spoke || speechMs >= opts.minSpeechMs;
  const silenceMs = speaking ? 0 : state.silenceMs + frameMs;
  const level = Math.min(1, Math.max(0, over / opts.levelRangeDb));
  return { floorDb, primed: true, speaking, spoke, speechMs, silenceMs, level, shouldStop: spoke && silenceMs >= opts.holdMs };
}

/** 배열 버전(acceptance 표기) — 꼬리 프레임이 thresholdDb 미만으로 holdMs 이상 이어지는가. */
export function detectSilence(framesDb: number[], thresholdDb: number, holdMs: number, frameMs: number): boolean {
  let tail = 0;
  for (let i = framesDb.length - 1; i >= 0 && framesDb[i] < thresholdDb; i--) tail += frameMs;
  return tail >= holdMs;
}
