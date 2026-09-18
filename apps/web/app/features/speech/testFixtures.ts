import { vi } from 'vitest';
import type { Meter, RecorderDeps } from './useRecorder';

/** 테스트용 MediaRecorder — stop() 하면 dataavailable(1바이트 Blob) → stop 을 동기로 쏜다. */
export class FakeMediaRecorder extends EventTarget {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus';
  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType: string;
  constructor(
    public stream: MediaStream,
    options?: { mimeType?: string },
  ) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['x'], { type: this.mimeType }) }));
    this.dispatchEvent(new Event('stop'));
  }
}

export function fakeStream() {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

export function fakeRecorderDeps(over: Partial<RecorderDeps> = {}): RecorderDeps {
  return {
    getUserMedia: vi.fn(async () => fakeStream().stream),
    MediaRecorderImpl: FakeMediaRecorder as unknown as typeof MediaRecorder,
    ...over,
  };
}

export const deniedError = () => Object.assign(new Error('nope'), { name: 'NotAllowedError' });

/** 테스트용 레벨 미터 — dB 프레임을 순서대로 돌려주고(마지막 값 반복) close 를 기록한다. */
export function fakeMeter(framesDb: number[]) {
  let i = 0;
  const close = vi.fn();
  const meter: Meter = {
    read: () => {
      const db = framesDb[Math.min(i, framesDb.length - 1)];
      i += 1;
      const amp = Math.pow(10, db / 20);
      return new Float32Array([amp, -amp, amp, -amp]);
    },
    close,
  };
  return { meter, close };
}

/** 제어 가능한 TTS 재생기. play() 는 resolvePlay()/rejectPlay() 로, open() 세션은 session.resolve()/reject(played) 로 끝낸다. */
export function fakePlayer() {
  let settle: { resolve: () => void; reject: (e: Error) => void } | null = null;
  const sessions: FakeSession[] = [];
  const player = {
    unlock: vi.fn(),
    stop: vi.fn(() => {
      settle?.resolve();
      sessions.forEach((s) => s.resolve());
    }),
    play: vi.fn(
      (text: string) =>
        new Promise<void>((resolve, reject) => {
          void text;
          settle = { resolve, reject };
        }),
    ),
    open: vi.fn(() => {
      const s = fakeSession();
      sessions.push(s);
      return s;
    }),
    resolvePlay: () => settle?.resolve(),
    rejectPlay: (e = new Error('tts')) => settle?.reject(e),
    /** 마지막으로 연 세션 */
    get session() {
      return sessions[sessions.length - 1];
    },
  };
  return player;
}

type FakeSession = ReturnType<typeof fakeSession>;
function fakeSession() {
  let settle!: { resolve: () => void; reject: (e: Error) => void };
  const done = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  done.catch(() => {});
  const session = {
    enqueue: vi.fn(),
    end: vi.fn(),
    done,
    played: false,
    resolve: () => settle.resolve(),
    /** played = 실패 시점에 첫 오디오가 시작됐었는가(D-033 B3 폴백 분기) */
    reject: (played: boolean, e = new Error('tts')) => {
      session.played = played;
      settle.reject(e);
    },
  };
  return session;
}
