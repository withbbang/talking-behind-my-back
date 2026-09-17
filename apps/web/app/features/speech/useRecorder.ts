'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickMimeType } from './mime';

/**
 * 녹음 훅 (DESIGN.md#7, D-029). MediaRecorder + getUserMedia. mime 은 pickMimeType(iOS Safari 는 mp4).
 * start() 실패는 RecorderError(kind: denied | unsupported | failed). maxMs 에 닿으면 자동 종료 → onAutoStop(hitLimit=true).
 * deps 는 테스트 주입용(기본은 브라우저 API).
 */
export type Recording = { blob: Blob; mimeType: string; durationMs: number; hitLimit: boolean };

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
};

export const defaultRecorderDeps: RecorderDeps = {
  getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  MediaRecorderImpl: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
};

type Options = { maxMs?: number; onAutoStop?: (rec: Recording) => void };
type Session = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; mimeType: string; startedAt: number; timers: ReturnType<typeof setTimeout>[] };

const TICK_MS = 250;

export function useRecorder(options: Options = {}, deps: RecorderDeps = defaultRecorderDeps) {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const session = useRef<Session | null>(null);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  const cleanup = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.timers.forEach(clearTimeout);
    s.stream.getTracks().forEach((t) => t.stop());
    session.current = null;
    setStatus('idle');
    setElapsedMs(0);
  }, []);

  const finish = useCallback(
    (hitLimit: boolean) =>
      new Promise<Recording>((resolve, reject) => {
        const s = session.current;
        if (!s) {
          reject(new RecorderError('failed', 'not recording'));
          return;
        }
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
      }),
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
    const s: Session = { recorder, stream, chunks: [], mimeType: picked ?? recorder.mimeType ?? 'audio/webm', startedAt: Date.now(), timers: [] };
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
          if (session.current !== s) return;
          void finish(true).then((rec) => opts.current.onAutoStop?.(rec));
        }, maxMs),
      );
    }
  }, [deps, finish]);

  const stop = useCallback(() => finish(false), [finish]);

  const cancel = useCallback(() => {
    const s = session.current;
    if (s && s.recorder.state === 'recording') s.recorder.stop();
    cleanup();
  }, [cleanup]);

  useEffect(() => () => cancel(), [cancel]);

  return { status, elapsedMs, start, stop, cancel };
}
