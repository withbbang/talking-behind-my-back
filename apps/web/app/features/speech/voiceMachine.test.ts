import { describe, expect, it } from 'vitest';
import { initialVoiceState, reduceVoice, type VoiceState } from './voiceMachine';

const at = (phase: VoiceState['phase'], extra: Partial<VoiceState> = {}): VoiceState => ({ ...initialVoiceState, phase, ...extra });

describe('voiceMachine (DESIGN.md#7 상태 머신, 순수 함수)', () => {
  it('idle → START → recording, turn 1', () => {
    expect(reduceVoice(initialVoiceState, { type: 'START' })).toMatchObject({ phase: 'recording', turn: 1 });
  });

  it('recording 에 들어갈 때마다 turn 이 1 씩 는다(재녹음을 효과가 구분하도록) — TTS_END·STT_EMPTY·RETRY', () => {
    expect(reduceVoice(at('speaking', { replyTo: 1, speech: 'x', turn: 3 }), { type: 'TTS_END' }).turn).toBe(4);
    expect(reduceVoice(at('transcribing', { turn: 3 }), { type: 'STT_EMPTY' }).turn).toBe(4);
    expect(reduceVoice(at('recording', { turn: 3 }), { type: 'RETRY' }).turn).toBe(4);
  });

  it('녹음 시작 실패(RECORD_FAIL) → error 공용 문구', () => {
    expect(reduceVoice(at('recording'), { type: 'RECORD_FAIL' })).toMatchObject({ phase: 'error', error: '시스템 오류. 다시 시도해줄래?' });
  });

  it('정상 루프: recording → STOP → transcribing → SENT → streaming(replyTo) → STREAM_DONE → speaking → TTS_END → recording', () => {
    let s = reduceVoice(at('recording'), { type: 'STOP' });
    expect(s.phase).toBe('transcribing');
    s = reduceVoice(s, { type: 'SENT', messageId: 77 });
    expect(s).toMatchObject({ phase: 'streaming', replyTo: 77 });
    s = reduceVoice(s, { type: 'STREAM_DONE', text: '또? 놀랍지도 않네.' });
    expect(s).toMatchObject({ phase: 'speaking', replyTo: 77, speech: '또? 놀랍지도 않네.' });
    s = reduceVoice(s, { type: 'TTS_END' });
    expect(s).toMatchObject({ phase: 'recording', replyTo: null, speech: null });
  });

  it('STT 결과가 비면 transcribing → recording (다시 듣기)', () => {
    expect(reduceVoice(at('transcribing'), { type: 'STT_EMPTY' }).phase).toBe('recording');
  });

  it('실패는 error + 문구: STT_FAIL / SEND_FAIL(문구 전달) / STREAM_ERROR / TTS_FAIL', () => {
    expect(reduceVoice(at('transcribing'), { type: 'STT_FAIL' })).toMatchObject({ phase: 'error', error: '시스템 오류. 다시 시도해줄래?' });
    expect(reduceVoice(at('transcribing'), { type: 'SEND_FAIL', message: '아직 답 쓰는 중. 좀만 기다려줘!' })).toMatchObject({ phase: 'error', error: '아직 답 쓰는 중. 좀만 기다려줘!' });
    expect(reduceVoice(at('streaming', { replyTo: 1 }), { type: 'STREAM_ERROR' })).toMatchObject({ phase: 'error', replyTo: null });
    expect(reduceVoice(at('speaking', { replyTo: 1, speech: 'x' }), { type: 'TTS_FAIL' })).toMatchObject({ phase: 'error', speech: null });
  });

  it('PERMISSION_DENIED → denied, denied + RETRY → recording(재요청)', () => {
    const denied = reduceVoice(at('recording'), { type: 'PERMISSION_DENIED' });
    expect(denied.phase).toBe('denied');
    expect(reduceVoice(denied, { type: 'RETRY' }).phase).toBe('recording');
  });

  it('RETRY("다시")는 어느 단계에서든 현재 단계를 버리고 recording, replyTo·speech·error 초기화', () => {
    for (const phase of ['recording', 'transcribing', 'streaming', 'speaking', 'error'] as const) {
      expect(reduceVoice(at(phase, { replyTo: 5, speech: 'x', error: 'e' }), { type: 'RETRY' })).toMatchObject({ phase: 'recording', replyTo: null, speech: null, error: null });
    }
  });

  it('EXIT("끄기")는 어디서든 idle 로 초기화', () => {
    for (const phase of ['recording', 'transcribing', 'streaming', 'speaking', 'denied', 'error'] as const) {
      expect(reduceVoice(at(phase, { replyTo: 5 }), { type: 'EXIT' })).toEqual(initialVoiceState);
    }
  });

  it('단계에 맞지 않는 이벤트는 무시한다(늦게 도착한 TTS_END·STREAM_DONE·SENT 등)', () => {
    expect(reduceVoice(at('recording'), { type: 'TTS_END' })).toEqual(at('recording'));
    expect(reduceVoice(at('recording'), { type: 'STREAM_DONE', text: 'x' })).toEqual(at('recording'));
    expect(reduceVoice(initialVoiceState, { type: 'SENT', messageId: 1 })).toEqual(initialVoiceState);
    expect(reduceVoice(at('speaking', { replyTo: 1 }), { type: 'STOP' })).toEqual(at('speaking', { replyTo: 1 }));
  });

  it('STREAM_DONE 은 추적 중인 replyTo 의 응답만 받는다(2인 방에서 상대 응답 무시, D-029)', () => {
    const s = at('streaming', { replyTo: 7 });
    expect(reduceVoice(s, { type: 'STREAM_DONE', text: '상대 답', replyTo: 8 })).toEqual(s);
    expect(reduceVoice(s, { type: 'STREAM_DONE', text: '내 답', replyTo: 7 }).phase).toBe('speaking');
  });
});
