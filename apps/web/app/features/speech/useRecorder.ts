'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickMimeType } from './mime';
import { initialVadState, rmsDb, stepVad, type VadState } from './vad';

/**
 * 녹음 훅 (DESIGN.md#7, D-029, D-033). MediaRecorder + getUserMedia. mime 은 pickMimeType(iOS Safari 는 mp4).
 * start() 실패는 RecorderError(kind: denied | unsupported | failed). maxMs 에 닿으면 자동 종료 → onAutoStop(rec, 'limit').
 * vad 를 켜면(보이스 모드만, D-033 A3) 미터(AnalyserNode)로 50ms 마다 stepVad — 발화 뒤 무음이 이어지면 onAutoStop(rec, 'silence').
 * level(0~1)은 vad 를 켠 녹음에서 노출한다(오브 진폭, A4). 컴포저(vad 없음)는 미터를 만들지 않는다. 미터를 못 만들면(Web Audio 없음) 녹음만 한다.
 * deps 는 테스트 주입용(기본은 브라우저 API).
 */
export type Recording = { blob: Blob; mimeType: string; durationMs: number; hitLimit: boolean };
export type AutoStopReason = 'limit' | 'silence';

/** 마이크 레벨 미터 — read() 는 최근 시간 영역 샘플(-1~1). */
export type Meter = { read: () => Float32Array; close: () => void };

export class RecorderError extends Error {
  constructor(
    public readonly kind: 'denied' | 'unsupported' | 'failed',
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'RecorderError';
  }
}

export type RecorderDeps = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorderImpl: typeof MediaRecorder | undefined;
  /** 없거나 null 을 돌려주면 level·VAD 없이 녹음만 한다 */
  createMeter?: (stream: MediaStream) => Meter | null;
};

function createAnalyserMeter(stream: MediaStream): Meter | null {
  const Ctx = typeof AudioContext === 'undefined' ? undefined : AudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  void ctx.resume().catch(() => {}); // iOS: 제스처 밖에서 만들면 suspended 로 시작할 수 있다
  const buf = new Float32Array(analyser.fftSize);
  return {
    read: () => {
      analyser.getFloatTimeDomainData(buf);
      return buf;
    },
    close: () => {
      void ctx.close().catch(() => {});
    },
  };
}

export const defaultRecorderDeps: RecorderDeps = {
  getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  MediaRecorderImpl: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
  createMeter: createAnalyserMeter,
};

type Options = { maxMs?: number; vad?: boolean; onAutoStop?: (rec: Recording, reason: AutoStopReason) => void };
type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mimeType: string;
  startedAt: number;
  timers: ReturnType<typeof setTimeout>[];
  meter: Meter | null;
  vad: VadState;
  /** finish 가 시작됐으면 그 결과 — stop 이벤트가 늦게 와도 recorder.stop() 은 한 번만 */
  finishing: Promise<Recording> | null;
};

const TICK_MS = 250;
const VAD_FRAME_MS = 50;

export function useRecorder(options: Options = {}, deps: RecorderDeps = defaultRecorderDeps) {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const session = useRef<Session | null>(null);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const cleanup = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.timers.forEach(clearTimeout);
    s.meter?.close();
    s.stream.getTracks().forEach((t) => t.stop());
    session.current = null;
    setStatus('idle');
    setElapsedMs(0);
    setLevel(0);
  }, []);

  const finish = useCallback(
    (hitLimit: boolean): Promise<Recording> => {
      const s = session.current;
      if (!s) return Promise.reject(new RecorderError('failed', 'not recording'));
      if (s.finishing) return s.finishing;
      s.finishing = new Promise<Recording>((resolve) => {
        s.recorder.addEventListener(
          'stop',
          () => {
            const durationMs = Date.now() - s.startedAt;
            const blob = new Blob(s.chunks, { type: s.mimeType.split(';')[0] });
            cleanup();
            resolve({ blob, mimeType: s.mimeType, durationMs, hitLimit });
          },
          { once: true },
        );
        s.recorder.stop();
      });
      return s.finishing;
    },
    [cleanup],
  );

  const start = useCallback(async () => {
    const Impl = deps.MediaRecorderImpl;
    if (!Impl) throw new RecorderError('unsupported');
    if (session.current) return;
    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      throw new RecorderError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed', String(e));
    }
    const picked = pickMimeType((t) => Impl.isTypeSupported(t));
    const recorder = new Impl(stream, picked ? { mimeType: picked } : undefined);
    let meter: Meter | null = null;
    if (opts.current.vad) {
      try {
        meter = deps.createMeter?.(stream) ?? null;
      } catch {
        meter = null;
      }
    }
    const s: Session = { recorder, stream, chunks: [], mimeType: picked ?? recorder.mimeType ?? 'audio/webm', startedAt: Date.now(), timers: [], meter, vad: initialVadState(), finishing: null };
    recorder.addEventListener('dataavailable', (e: BlobEvent) => {
      if (e.data && e.data.size > 0) s.chunks.push(e.data);
    });
    session.current = s;
    recorder.start();
    setStatus('recording');
    setElapsedMs(0);
    const tick = setInterval(() => setElapsedMs(Date.now() - s.startedAt), TICK_MS);
    s.timers.push(tick as unknown as ReturnType<typeof setTimeout>);
    const { maxMs } = opts.current;
    if (maxMs) {
      s.timers.push(
        setTimeout(() => {
          if (session.current !== s || s.finishing) return;
          void finish(true).then((rec) => opts.current.onAutoStop?.(rec, 'limit'));
        }, maxMs),
      );
    }
    if (meter) {
      const m = meter;
      const frame = setInterval(() => {
        if (session.current !== s || s.finishing) return;
        s.vad = stepVad(s.vad, rmsDb(m.read()), VAD_FRAME_MS);
        setLevel(s.vad.level);
        if (opts.current.vad && s.vad.shouldStop) {
          void finish(false).then((rec) => opts.current.onAutoStop?.(rec, 'silence'));
        }
      }, VAD_FRAME_MS);
      s.timers.push(frame as unknown as ReturnType<typeof setTimeout>);
    }
  }, [deps, finish]);

  const stop = useCallback(() => finish(false), [finish]);

  const cancel = useCallback(() => {
    const s = session.current;
    if (s && s.recorder.state === 'recording') s.recorder.stop();
    cleanup();
  }, [cleanup]);

  useEffect(() => () => cancel(), [cancel]);

  return { status, elapsedMs, level, start, stop, cancel };
}
