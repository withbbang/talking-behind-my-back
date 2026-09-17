import { vi } from 'vitest';
import type { RecorderDeps } from './useRecorder';

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

/** 제어 가능한 TTS 재생기. play() 는 resolvePlay()/rejectPlay() 로 끝낸다. */
export function fakePlayer() {
  let settle: { resolve: () => void; reject: (e: Error) => void } | null = null;
  const player = {
    unlock: vi.fn(),
    stop: vi.fn(() => settle?.resolve()),
    play: vi.fn(
      (text: string) =>
        new Promise<void>((resolve, reject) => {
          void text;
          settle = { resolve, reject };
        }),
    ),
    resolvePlay: () => settle?.resolve(),
    rejectPlay: (e = new Error('tts')) => settle?.reject(e),
  };
  return player;
}
