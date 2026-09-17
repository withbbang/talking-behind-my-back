'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useToastStore } from '@/components/ui/Toast';
import { sendErrorMessage } from '@/features/messages/sendErrorMessage';
import { useStreamStore } from '@/features/messages/streamStore';
import { GENERIC_ERROR, VOICE_COPY, VOICE_MAX_MS } from '@/lib/copy';
import { transcribe as transcribeApi } from './speechApi';
import type { TtsPlayer } from './ttsPlayer';
import { defaultRecorderDeps, RecorderError, useRecorder, type RecorderDeps, type Recording } from './useRecorder';
import { useTtsStore } from './useTts';
import { initialVoiceState, reduceVoice } from './voiceMachine';

/**
 * 보이스 모드 루프 (DESIGN.md#7, D-029). 순수 리듀서(voiceMachine)의 phase 변화에 효과를 붙인다:
 * recording 진입 → 녹음 시작 / done() → STT → 전송(VOICE) → streaming / lastDone(내 replyTo) → speaking → TTS 재생 → recording.
 * "다시"·"끄기"·active=false 는 세대(run)를 올려 진행 중인 비동기 결과를 무시한다.
 */
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
      onAutoStop: (rec) => {
        show(VOICE_COPY.limit);
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

  // streaming: 내 replyTo 의 done / error
  useEffect(() => {
    if (state.phase !== 'streaming' || state.replyTo === null) return;
    if (lastDone && lastDone.replyTo === state.replyTo) dispatch({ type: 'STREAM_DONE', text: lastDone.text, replyTo: lastDone.replyTo });
    else if (entry?.status === 'error') dispatch({ type: 'STREAM_ERROR' });
  }, [state.phase, state.replyTo, lastDone, entry?.status]);

  // speaking → TTS 재생 → 끝나면 다시 녹음
  useEffect(() => {
    if (state.phase !== 'speaking') return;
    const gen = run.current;
    player.play(state.speech ?? '').then(
      () => {
        if (run.current === gen) dispatch({ type: 'TTS_END' });
      },
      () => {
        if (run.current === gen) dispatch({ type: 'TTS_FAIL' });
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
    player.stop();
    cancelRecorder();
    dispatch({ type: 'RETRY' });
  }, [player, cancelRecorder]);

  const exit = useCallback(() => {
    run.current += 1;
    player.stop();
    cancelRecorder();
    dispatch({ type: 'EXIT' });
    params.current.onExit();
  }, [player, cancelRecorder]);

  return { state, elapsedMs: recorder.elapsedMs, preview: entry?.text ?? '', done, retry, exit };
}
