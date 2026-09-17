import { SILENT_WAV_DATA_URI } from './silentWav';
import { splitForTts } from './splitForTts';

/**
 * TTS 재생 큐 (D-029). Audio 엘리먼트 1개를 재사용한다 — unlock() 을 사용자 제스처에서 불러 두면 이후 비동기 재생도 iOS 에서 허용된다.
 * play(): 문장 경계로 나눠(1,000자 상한) 순서대로 이어 재생, 끝나면 resolve. 새 play/stop 은 진행 중인 재생을 멈추고 그 play 를 resolve 시킨다(reject 아님).
 * 합성 실패·재생 오류만 reject.
 */
export type TtsPlayerDeps = {
  synthesize: (text: string) => Promise<Blob>;
  createAudio: () => HTMLAudioElement;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export type TtsPlayer = {
  unlock: () => void;
  play: (text: string) => Promise<void>;
  stop: () => void;
};

type Run = { aborted: boolean; onAbort: () => void };

export function createTtsPlayer(deps: TtsPlayerDeps): TtsPlayer {
  let audio: HTMLAudioElement | null = null;
  let current: Run | null = null;
  const el = () => (audio ??= deps.createAudio());

  const stop = () => {
    if (!current) return;
    current.aborted = true;
    current.onAbort();
    current = null;
    const a = el();
    a.pause();
    a.currentTime = 0;
  };

  const playOnce = (a: HTMLAudioElement, url: string, run: Run) =>
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        a.removeEventListener('ended', onEnded);
        a.removeEventListener('error', onError);
        run.onAbort = () => {};
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('audio playback failed'));
      };
      run.onAbort = () => {
        cleanup();
        resolve();
      };
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);
      a.src = url;
      a.play().catch(onError);
    });

  return {
    unlock() {
      const a = el();
      a.src = SILENT_WAV_DATA_URI;
      void a.play().catch(() => {});
    },
    async play(text) {
      stop();
      const chunks = splitForTts(text);
      if (chunks.length === 0) return;
      const run: Run = { aborted: false, onAbort: () => {} };
      current = run;
      const a = el();
      try {
        for (const chunk of chunks) {
          if (run.aborted) return;
          const blob = await deps.synthesize(chunk);
          if (run.aborted) return;
          const url = deps.createObjectURL(blob);
          try {
            await playOnce(a, url, run);
          } finally {
            deps.revokeObjectURL(url);
          }
        }
      } finally {
        if (current === run) current = null;
      }
    },
    stop,
  };
}
