import { GENERIC_ERROR } from '@/lib/copy';

/**
 * 보이스 모드 상태 머신 (DESIGN.md#7, D-029) — 순수 리듀서. 부수효과(녹음·STT·전송·TTS)는 useVoiceMode 가 상태 변화에 반응해 수행한다.
 * 루프: idle → recording → transcribing → streaming → speaking → recording. 부가 상태 denied(마이크 권한)·error(문구 + "다시").
 * 단계에 맞지 않는 이벤트(늦게 도착한 TTS_END 등)는 무시한다. STREAM_DONE 은 추적 중인 replyTo 의 것만 받는다(2인 방).
 */
export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'streaming' | 'speaking' | 'denied' | 'error';

export type VoiceState = {
  phase: VoicePhase;
  /** streaming·speaking 중 추적하는 내 USER 메시지 id */
  replyTo: number | null;
  /** speaking 중 읽을 assistant 본문 */
  speech: string | null;
  /** error 단계의 문구 */
  error: string | null;
  /** recording 에 들어간 횟수 — 같은 phase 로 되돌아와도 효과(녹음 재시작)가 구분하도록 */
  turn: number;
};

export type VoiceEvent =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'RECORD_FAIL' }
  | { type: 'STT_EMPTY' }
  | { type: 'STT_FAIL' }
  | { type: 'SENT'; messageId: number }
  | { type: 'SEND_FAIL'; message: string }
  | { type: 'STREAM_DONE'; text: string; replyTo?: number }
  | { type: 'STREAM_ERROR' }
  | { type: 'TTS_END' }
  | { type: 'TTS_FAIL' }
  | { type: 'RETRY' }
  | { type: 'EXIT' }
  | { type: 'PERMISSION_DENIED' };

export const initialVoiceState: VoiceState = { phase: 'idle', replyTo: null, speech: null, error: null, turn: 0 };

const recording = (state: VoiceState): VoiceState => ({ ...initialVoiceState, phase: 'recording', turn: state.turn + 1 });
const fail = (state: VoiceState, message: string = GENERIC_ERROR): VoiceState => ({ ...initialVoiceState, phase: 'error', error: message, turn: state.turn });

export function reduceVoice(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'EXIT':
      return initialVoiceState;
    case 'RETRY':
      return state.phase === 'idle' ? state : recording(state);
    case 'PERMISSION_DENIED':
      return state.phase === 'idle' ? state : { ...initialVoiceState, phase: 'denied', turn: state.turn };
    case 'START':
      return state.phase === 'idle' ? recording(state) : state;
    case 'STOP':
      return state.phase === 'recording' ? { ...state, phase: 'transcribing' } : state;
    case 'RECORD_FAIL':
      return state.phase === 'recording' ? fail(state) : state;
    case 'STT_EMPTY':
      return state.phase === 'transcribing' ? recording(state) : state;
    case 'STT_FAIL':
      return state.phase === 'transcribing' ? fail(state) : state;
    case 'SEND_FAIL':
      return state.phase === 'transcribing' ? fail(state, event.message) : state;
    case 'SENT':
      return state.phase === 'transcribing' ? { ...initialVoiceState, phase: 'streaming', replyTo: event.messageId, turn: state.turn } : state;
    case 'STREAM_DONE':
      if (state.phase !== 'streaming') return state;
      if (event.replyTo !== undefined && event.replyTo !== state.replyTo) return state;
      return { ...state, phase: 'speaking', speech: event.text };
    case 'STREAM_ERROR':
      return state.phase === 'streaming' ? fail(state) : state;
    case 'TTS_END':
      return state.phase === 'speaking' ? recording(state) : state;
    case 'TTS_FAIL':
      return state.phase === 'speaking' ? fail(state) : state;
  }
}
