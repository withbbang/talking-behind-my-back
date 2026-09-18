import { describe, expect, it } from 'vitest';
import { detectSilence, initialVadState, rmsDb, stepVad, VAD_DEFAULTS, type VadState } from './vad';

const FRAME = 50;
const QUIET = -60;
const LOUD = -20;

/** dB 프레임을 순서대로 먹인 마지막 상태 */
function run(frames: number[], state: VadState = initialVadState(), frameMs = FRAME) {
  return frames.reduce((s, db) => stepVad(s, db, frameMs), state);
}
const times = (n: number, db: number) => Array.from({ length: n }, () => db);

describe('rmsDb (AnalyserNode 시간 영역 샘플 → dBFS)', () => {
  it('풀스케일 ±1 은 0dB, 0.1 진폭은 -20dB', () => {
    expect(rmsDb(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(0, 5);
    expect(rmsDb(new Float32Array([0.1, -0.1, 0.1, -0.1]))).toBeCloseTo(-20, 5);
  });

  it('완전 무음(전부 0)·빈 배열은 -100 으로 클램프', () => {
    expect(rmsDb(new Float32Array(8))).toBe(-100);
    expect(rmsDb(new Float32Array(0))).toBe(-100);
  });
});

describe('stepVad (적응형 무음 감지, D-033 A1·A2)', () => {
  it('발화가 없으면 아무리 조용해도 shouldStop 이 아니다(60초 상한이 잡는다)', () => {
    const s = run(times(200, QUIET));
    expect(s.spoke).toBe(false);
    expect(s.shouldStop).toBe(false);
  });

  it('발화 뒤 무음이 holdMs(1,000) 이상 이어지면 shouldStop', () => {
    const spoken = run([...times(10, QUIET), ...times(10, LOUD)]);
    expect(spoken.spoke).toBe(true);
    expect(spoken.speaking).toBe(true);
    const almost = run(times(19, QUIET), spoken); // 950ms
    expect(almost.shouldStop).toBe(false);
    const done = run(times(1, QUIET), almost); // 1,000ms
    expect(done.shouldStop).toBe(true);
    expect(done.silenceMs).toBeGreaterThanOrEqual(VAD_DEFAULTS.holdMs);
  });

  it('무음 중 다시 말하면 silenceMs 가 0 으로 돌아간다', () => {
    const s = run([...times(10, QUIET), ...times(10, LOUD), ...times(10, QUIET), LOUD, LOUD]);
    expect(s.silenceMs).toBe(0);
    expect(s.shouldStop).toBe(false);
  });

  it('minSpeechMs(200) 미만의 짧은 소리(클릭)는 발화로 치지 않는다', () => {
    const s = run([...times(10, QUIET), ...times(3, LOUD), ...times(40, QUIET)]);
    expect(s.spoke).toBe(false);
    expect(s.shouldStop).toBe(false);
  });

  it('히스테리시스: 바닥+6 ~ +12 사이는 직전 speaking 을 유지한다', () => {
    const floor = run(times(10, QUIET)).floorDb;
    const mid = floor + 9;
    expect(run([mid], run(times(10, QUIET))).speaking).toBe(false);
    expect(run([mid], run([...times(10, QUIET), ...times(10, LOUD)])).speaking).toBe(true);
  });

  it('노이즈 바닥은 내려갈 땐 즉시, 올라갈 땐 초당 riseDbPerSec 만큼만 따라간다', () => {
    const down = run([QUIET, -80]);
    expect(down.floorDb).toBe(-80);
    const up = run([-80, -78]);
    expect(up.floorDb).toBeCloseTo(-80 + (VAD_DEFAULTS.riseDbPerSec * FRAME) / 1000, 5);
  });

  it('첫 프레임 바닥은 min(첫 dB, -50) — 처음부터 말하고 있어도 발화로 잡힌다', () => {
    const s = run(times(5, LOUD));
    expect(s.floorDb).toBe(-50);
    expect(s.speaking).toBe(true);
  });

  it('level 은 바닥 기준 0~1 (바닥 = 0, 바닥+30 이상 = 1)', () => {
    expect(run(times(10, QUIET)).level).toBe(0);
    expect(run([...times(10, QUIET), QUIET + 15]).level).toBeCloseTo(0.5, 5);
    expect(run([...times(10, QUIET), QUIET + 40]).level).toBe(1);
  });

  it('이전 세션의 바닥을 이어받을 수 있다(initialVadState(floorDb))', () => {
    expect(initialVadState(-42).floorDb).toBe(-42);
    expect(run([LOUD], initialVadState(-42)).floorDb).toBe(-42);
  });
});

describe('detectSilence(frames, thresholdDb, holdMs) — 꼬리 무음 창', () => {
  it('마지막 프레임들이 threshold 미만으로 holdMs 이상 이어지면 true', () => {
    expect(detectSilence([LOUD, LOUD, ...times(20, QUIET)], -50, 1000, FRAME)).toBe(true);
    expect(detectSilence([LOUD, LOUD, ...times(19, QUIET)], -50, 1000, FRAME)).toBe(false);
    expect(detectSilence([...times(20, QUIET), LOUD], -50, 1000, FRAME)).toBe(false);
  });
});
