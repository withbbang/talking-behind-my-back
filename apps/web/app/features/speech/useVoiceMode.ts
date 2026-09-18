'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useToastStore } from '@/components/ui/Toast';
import { sendErrorMessage } from '@/features/messages/sendErrorMessage';
import { useStreamStore } from '@/features/messages/streamStore';
import { GENERIC_ERROR, VOICE_COPY, VOICE_MAX_MS } from '@/lib/copy';
import { createSentenceChunker, type SentenceChunker } from './sentenceChunker';
import { transcribe as transcribeApi } from './speechApi';
import type { TtsPlayer, TtsSession } from './ttsPlayer';
import { defaultRecorderDeps, RecorderError, useRecorder, type RecorderDeps, type Recording } from './useRecorder';
import { useTtsStore } from './useTts';
import { initialVoiceState, reduceVoice } from './voiceMachine';

/**
 * 보이스 모드 루프 (DESIGN.md#7, D-029, D-033). 순수 리듀서(voiceMachine)의 phase 변화에 효과를 붙인다:
 * recording 진입 → 녹음 시작(VAD: 말한 뒤 무음이면 자동 완료) / done() → STT → 전송(VOICE) → streaming / lastDone(내 replyTo) → speaking → recording.
 * streaming 에 들어가면 TTS 세션을 열고 델타를 문장 단위로 잘라 바로 재생 큐에 넣는다(선재생). done 이 오면 델타로 못 받은 나머지 + 꼬리를 넣고 end(),
 * speaking 은 큐가 빌 때까지 기다린다. 첫 오디오 전에 세션이 실패하면 전체 텍스트 TTS 로 폴백(B3), 재생 후 실패는 error.
 * "다시"·"끄기"·active=false 는 세대(run)를 올려 진행 중인 비동기 결과를 무시한다.
 */
type Live = { session: TtsSession; chunker: SentenceChunker; fed: string };

export type VoiceModeDeps = {
  player: TtsPlayer;
  transcribe: (rec: Recording) => Promise<{ text: string; durationMs: number }>;
  recorderDeps: RecorderDeps;
};

type Params = {
  roomId: number;
  active: boolean;
  send: (content: string) => Promise<{ messageId: number }>;
  onExit: () => void;
};

export function useVoiceMode({ roomId, active, send, onExit }: Params, deps?: VoiceModeDeps) {
  const storePlayer = useTtsStore((s) => s.player);
  const player = deps?.player ?? storePlayer;
  const transcribe = deps?.transcribe ?? transcribeApi;
  const [state, dispatch] = useReducer(reduceVoice, initialVoiceState);
  const show = useToastStore((s) => s.show);
  const run = useRef(0);
  const params = useRef({ send, onExit });
  useEffect(() => {
    params.current = { send, onExit };
  });

  const entry = useStreamStore((s) => (state.replyTo === null ? undefined : s.rooms[roomId]?.streams[state.replyTo]));
  const lastDone = useStreamStore((s) => s.rooms[roomId]?.lastDone);
  const live = useRef<Live | null>(null);

  const handleRecording = useCallback(
    async (rec: Recording) => {
      const gen = run.current;
      const stale = () => run.current !== gen;
      let text: string;
      try {
        text = (await transcribe(rec)).text;
      } catch {
        if (!stale()) dispatch({ type: 'STT_FAIL' });
        return;
      }
      if (stale()) return;
      if (!text) {
        show(VOICE_COPY.empty);
        dispatch({ type: 'STT_EMPTY' });
        return;
      }
      try {
        const { messageId } = await params.current.send(text);
        if (!stale()) dispatch({ type: 'SENT', messageId });
      } catch (e) {
        if (!stale()) dispatch({ type: 'SEND_FAIL', message: sendErrorMessage(e) ?? GENERIC_ERROR });
      }
    },
    [transcribe, show],
  );

  const recorder = useRecorder(
    {
      maxMs: VOICE_MAX_MS,
      vad: true,
      onAutoStop: (rec, reason) => {
        if (reason === 'limit') show(VOICE_COPY.limit);
        dispatch({ type: 'STOP' });
        void handleRecording(rec);
      },
    },
    deps?.recorderDeps ?? defaultRecorderDeps,
  );
  const { start: startRecorder, stop: stopRecorder, cancel: cancelRecorder } = recorder;

  // active 토글: 켜지면 START, 꺼지면 전부 정리 + EXIT
  useEffect(() => {
    if (active) {
      dispatch({ type: 'START' });
      return;
    }
    run.current += 1;
    live.current = null;
    player.stop();
    cancelRecorder();
    dispatch({ type: 'EXIT' });
  }, [active, player, cancelRecorder]);

  // recording 진입(turn 마다) → 녹음 시작
  useEffect(() => {
    if (state.phase !== 'recording') return;
    const gen = ++run.current;
    startRecorder().catch((e: unknown) => {
      if (run.current !== gen) return;
      dispatch({ type: e instanceof RecorderError && e.kind === 'denied' ? 'PERMISSION_DENIED' : 'RECORD_FAIL' });
    });
  }, [state.phase, state.turn, startRecorder]);

  // streaming 진입 → 선재생 세션 열기
  useEffect(() => {
    if (state.phase !== 'streaming') return;
    live.current = { session: player.open(), chunker: createSentenceChunker(), fed: '' };
  }, [state.phase, state.replyTo, player]);

  // streaming: 델타 증가분을 문장 단위로 재생 큐에
  const streamText = entry?.text ?? '';
  useEffect(() => {
    if (state.phase !== 'streaming') return;
    const l = live.current;
    if (!l || streamText.length <= l.fed.length || !streamText.startsWith(l.fed)) return;
    for (const sentence of l.chunker.feed(streamText.slice(l.fed.length))) l.session.enqueue(sentence);
    l.fed = streamText;
  }, [state.phase, streamText]);

  // streaming: 내 replyTo 의 done / error
  useEffect(() => {
    if (state.phase !== 'streaming' || state.replyTo === null) return;
    if (lastDone && lastDone.replyTo === state.replyTo) dispatch({ type: 'STREAM_DONE', text: lastDone.text, replyTo: lastDone.replyTo });
    else if (entry?.status === 'error') dispatch({ type: 'STREAM_ERROR' });
  }, [state.phase, state.replyTo, lastDone, entry?.status]);

  // speaking → 세션 큐 마무리(나머지 + 꼬리, end) → 소진되면 다시 녹음. 세션이 없거나 첫 오디오 전에 실패하면 전체 텍스트 재생으로 폴백.
  useEffect(() => {
    if (state.phase !== 'speaking') return;
    const gen = run.current;
    const full = state.speech ?? '';
    const settle = (p: Promise<void>) =>
      p.then(
        () => {
          if (run.current === gen) dispatch({ type: 'TTS_END' });
        },
        () => {
          if (run.current === gen) dispatch({ type: 'TTS_FAIL' });
        },
      );
    const l = live.current;
    live.current = null;
    if (!l) {
      settle(player.play(full));
      return;
    }
    const rest = full.startsWith(l.fed) ? full.slice(l.fed.length) : '';
    for (const sentence of l.chunker.feed(rest)) l.session.enqueue(sentence);
    const tail = l.chunker.flush();
    if (tail) l.session.enqueue(tail);
    l.session.end();
    l.session.done.then(
      () => {
        if (run.current === gen) dispatch({ type: 'TTS_END' });
      },
      () => {
        if (run.current !== gen) return;
        if (l.session.played) dispatch({ type: 'TTS_FAIL' });
        else settle(player.play(full));
      },
    );
  }, [state.phase, state.speech, player]);

  const done = useCallback(async () => {
    if (state.phase !== 'recording') return;
    dispatch({ type: 'STOP' });
    let rec: Recording;
    try {
      rec = await stopRecorder();
    } catch {
      dispatch({ type: 'STT_FAIL' });
      return;
    }
    await handleRecording(rec);
  }, [state.phase, stopRecorder, handleRecording]);

  const retry = useCallback(() => {
    run.current += 1;
    live.current = null;
    player.stop();
    cancelRecorder();
    dispatch({ type: 'RETRY' });
  }, [player, cancelRecorder]);

  const exit = useCallback(() => {
    run.current += 1;
    live.current = null;
    player.stop();
    cancelRecorder();
    dispatch({ type: 'EXIT' });
    params.current.onExit();
  }, [player, cancelRecorder]);

  return { state, elapsedMs: recorder.elapsedMs, level: recorder.level, preview: streamText, done, retry, exit };
}
