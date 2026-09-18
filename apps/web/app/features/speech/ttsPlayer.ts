import { SILENT_WAV_DATA_URI } from './silentWav';
import { splitForTts } from './splitForTts';

/**
 * TTS 재생 큐 (D-029, D-033 B4). Audio 엘리먼트 1개를 재사용한다 — unlock() 을 사용자 제스처에서 불러 두면 이후 비동기 재생도 iOS 에서 허용된다.
 * open(): 세션. enqueue(text) 로 덩어리를 순서대로 밀어넣고(1,000자 상한 분할은 여기서), end() 뒤 큐가 비면 done 이 resolve.
 *   합성은 재생보다 1개 앞서 미리 한다(끊김 없이 이어 재생, 호출은 필요한 만큼만). played = 첫 오디오가 시작됐는가(실패 시 폴백 판단용).
 * play(text): 세션 하나에 전부 넣고 end() 한 것과 같다. 새 open/play/stop 은 진행 중인 세션을 멈추고 그 done 을 resolve 시킨다(reject 아님).
 * 합성 실패·재생 오류만 reject.
 */
export type TtsPlayerDeps = {
  synthesize: (text: string) => Promise<Blob>;
  createAudio: () => HTMLAudioElement;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export type TtsSession = {
  enqueue: (text: string) => void;
  end: () => void;
  done: Promise<void>;
  readonly played: boolean;
};

export type TtsPlayer = {
  unlock: () => void;
  open: () => TtsSession;
  play: (text: string) => Promise<void>;
  stop: () => void;
};

type Run = {
  aborted: boolean;
  ended: boolean;
  played: boolean;
  /** 아직 합성을 시작하지 않은 덩어리 */
  texts: string[];
  /** 합성을 시작한 덩어리(재생 대기) — 최대 1개만 앞서 둔다 */
  ready: Promise<Blob>[];
  synthBusy: boolean;
  onAbort: () => void;
  wake: () => void;
};

export function createTtsPlayer(deps: TtsPlayerDeps): TtsPlayer {
  let audio: HTMLAudioElement | null = null;
  let current: Run | null = null;
  const el = () => (audio ??= deps.createAudio());

  const stop = () => {
    if (!current) return;
    const run = current;
    current = null;
    run.aborted = true;
    run.onAbort();
    run.wake();
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

  // 합성 파이프라인: 진행 중 1개, 준비된 것 1개 미만일 때만 다음을 시작한다
  const kick = (run: Run) => {
    if (run.aborted || run.synthBusy || run.ready.length >= 1) return;
    const text = run.texts.shift();
    if (text === undefined) return;
    run.synthBusy = true;
    const p = deps.synthesize(text);
    run.ready.push(p);
    // 거절은 pump 가 받는다 — 여기서는 파이프라인만 이어간다(finally 는 거절을 다시 던져 unhandled 가 된다)
    const after = () => {
      run.synthBusy = false;
      kick(run);
    };
    void p.then(after, after);
  };

  const pump = async (run: Run) => {
    const a = el();
    while (!run.aborted) {
      const next = run.ready.shift();
      if (!next) {
        if (run.ended && run.texts.length === 0 && !run.synthBusy) return;
        await new Promise<void>((resolve) => {
          run.wake = resolve;
        });
        continue;
      }
      kick(run);
      const blob = await next;
      if (run.aborted) return;
      const url = deps.createObjectURL(blob);
      try {
        run.played = true;
        await playOnce(a, url, run);
      } finally {
        deps.revokeObjectURL(url);
      }
    }
  };

  const open = (): TtsSession => {
    stop();
    const run: Run = { aborted: false, ended: false, played: false, texts: [], ready: [], synthBusy: false, onAbort: () => {}, wake: () => {} };
    current = run;
    const done = pump(run).finally(() => {
      if (current === run) current = null;
    });
    return {
      enqueue(text) {
        if (run.aborted) return;
        run.texts.push(...splitForTts(text));
        kick(run);
        run.wake();
      },
      end() {
        run.ended = true;
        run.wake();
      },
      done,
      get played() {
        return run.played;
      },
    };
  };

  return {
    unlock() {
      const a = el();
      a.src = SILENT_WAV_DATA_URI;
      void a.play().catch(() => {});
    },
    open,
    play(text) {
      const session = open();
      session.enqueue(text);
      session.end();
      return session.done;
    },
    stop,
  };
}
